import type {
  DependencyDepth,
  PackageVulnerabilityInfo,
  SecuritySourceStatus,
  VulnerabilityTreeResult,
  DeprecatedPackageInfo,
} from '#shared/types/dependency-analysis'
import { mapWithConcurrency } from '#shared/utils/async'
import { hasTransientSourceFailure } from '#shared/utils/security-sources'
import { CACHE_MAX_AGE_FIVE_MINUTES } from '#shared/utils/constants'
import { resolveDependencyTree } from './dependency-resolver'
import { queryOsvBatch, queryOsvDetails, type PackageQueryInfo } from './osv'

/** Maximum concurrent requests for fetching vulnerability details */
const OSV_DETAIL_CONCURRENCY = 25

/**
 * Analyze entire dependency tree for vulnerabilities and deprecated packages.
 * Uses OSV batch API for efficient vulnerability discovery, then fetches
 * full details only for packages with known vulnerabilities.
 */
export const analyzeDependencyTree = defineCachedFunction(
  async (name: string, version: string): Promise<VulnerabilityTreeResult> => {
    // Resolve all packages in the tree with depth tracking
    const resolved = await resolveDependencyTree(name, version, { trackDepth: true })

    // Convert to array with query info
    const packages: PackageQueryInfo[] = Array.from(resolved.values(), pkg => ({
      name: pkg.name,
      version: pkg.version,
      depth: pkg.depth!,
      path: pkg.path || [],
    }))

    // Collect deprecated packages (no API call needed - already in packument data)
    const deprecatedPackages: DeprecatedPackageInfo[] = [...resolved.values()]
      .filter(pkg => pkg.deprecated)
      .map(pkg => ({
        name: pkg.name,
        version: pkg.version,
        depth: pkg.depth!,
        path: pkg.path || [],
        message: pkg.deprecated!,
      }))
      .sort((a, b) => {
        // Sort by depth (root → direct → transitive)
        const depthOrder: Record<DependencyDepth, number> = { root: 0, direct: 1, transitive: 2 }
        return depthOrder[a.depth] - depthOrder[b.depth]
      })

    // Step 1: Use batch API to find which packages have vulnerabilities
    // This is much faster than individual queries - one request for all packages
    const { vulnerableIndices, failed: batchFailed } = await queryOsvBatch(packages)

    let vulnerablePackages: PackageVulnerabilityInfo[] = []
    let failedQueries = batchFailed ? packages.length : 0

    if (!batchFailed && vulnerableIndices.length > 0) {
      // Step 2: Fetch full vulnerability details only for packages with vulns
      // This is typically a small fraction of total packages
      const detailResults = await mapWithConcurrency(
        vulnerableIndices,
        i => queryOsvDetails(packages[i]!),
        OSV_DETAIL_CONCURRENCY,
      )

      for (const result of detailResults) {
        if (result) {
          vulnerablePackages.push(result)
        } else {
          failedQueries++
        }
      }
    }

    // Sort by depth (root → direct → transitive), then by severity
    const depthOrder: Record<DependencyDepth, number> = { root: 0, direct: 1, transitive: 2 }
    vulnerablePackages.sort((a, b) => {
      if (a.depth !== b.depth) return depthOrder[a.depth] - depthOrder[b.depth]
      if (a.counts.critical !== b.counts.critical) return b.counts.critical - a.counts.critical
      if (a.counts.high !== b.counts.high) return b.counts.high - a.counts.high
      if (a.counts.moderate !== b.counts.moderate) return b.counts.moderate - a.counts.moderate
      return b.counts.total - a.counts.total
    })

    // Aggregate total counts
    const totalCounts = { total: 0, critical: 0, high: 0, moderate: 0, low: 0 }
    for (const pkg of vulnerablePackages) {
      totalCounts.total += pkg.counts.total
      totalCounts.critical += pkg.counts.critical
      totalCounts.high += pkg.counts.high
      totalCounts.moderate += pkg.counts.moderate
      totalCounts.low += pkg.counts.low
    }

    // Log if batch query failed entirely
    if (batchFailed) {
      // oxlint-disable-next-line no-console -- critical error logging
      console.error(
        `[dep-analysis] Critical: OSV batch query failed for ${name}@${version} (${packages.length} packages)`,
      )
    }

    const osvStatus: SecuritySourceStatus = batchFailed
      ? 'failed'
      : failedQueries > 0
        ? 'partial'
        : 'ok'

    return {
      package: name,
      version,
      vulnerablePackages,
      deprecatedPackages,
      totalPackages: packages.length,
      failedQueries,
      totalCounts,
      sourceStatus: { osv: osvStatus },
    }
  },
  {
    maxAge: 60 * 60,
    swr: true,
    name: 'dependency-analysis',
    getKey: (name: string, version: string) => `v3:${name}@${version}`,
    // Results degraded by a transient source failure (e.g. an OSV outage)
    // are only served from cache briefly, so a blip doesn't strip findings
    // from the cache for a whole hour after recovery
    validate: entry => {
      // a custom validate replaces nitro's default entry.value !== undefined guard
      const result = entry.value
      if (!result) return false
      if (!hasTransientSourceFailure(result.sourceStatus)) return true
      return Date.now() - (entry.mtime ?? 0) < CACHE_MAX_AGE_FIVE_MINUTES * 1000
    },
  },
)
