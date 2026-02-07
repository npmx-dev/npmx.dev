import type {
  OsvQueryResponse,
  OsvBatchResponse,
  OsvVulnerability,
  OsvSeverityLevel,
  VulnerabilitySummary,
  DependencyDepth,
  PackageVulnerabilityInfo,
  VulnerabilityTreeResult,
  DeprecatedPackageInfo,
  OsvAffected,
  OsvRange,
} from '#shared/types/dependency-analysis'
import { mapWithConcurrency } from '#shared/utils/async'
import { resolveDependencyTree } from './dependency-resolver'
import * as semver from 'semver'

/** Maximum concurrent requests for fetching vulnerability details */
const OSV_DETAIL_CONCURRENCY = 25

/** Package info needed for OSV queries */
interface PackageQueryInfo {
  name: string
  version: string
  depth: DependencyDepth
  path: string[]
}

/**
 * Query OSV batch API to find which packages have vulnerabilities.
 * Returns indices of packages that have vulnerabilities (for follow-up detailed queries).
 * @see https://google.github.io/osv.dev/post-v1-querybatch/
 */
async function queryOsvBatch(
  packages: PackageQueryInfo[],
): Promise<{ vulnerableIndices: number[]; failed: boolean }> {
  if (packages.length === 0) return { vulnerableIndices: [], failed: false }

  try {
    const response = await $fetch<OsvBatchResponse>('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      body: {
        queries: packages.map(pkg => ({
          package: { name: pkg.name, ecosystem: 'npm' },
          version: pkg.version,
        })),
      },
    })

    // Find indices of packages that have vulnerabilities
    const vulnerableIndices: number[] = []
    for (let i = 0; i < response.results.length; i++) {
      const result = response.results[i]
      if (result?.vulns && result.vulns.length > 0) {
        vulnerableIndices.push(i)
      }
      // Warn if pagination token present (>1000 vulns for single query or >3000 total)
      // This is extremely unlikely for npm packages but log for visibility
      if (result?.next_page_token) {
        // oxlint-disable-next-line no-console -- warn about paginated results
        console.warn(
          `[dep-analysis] OSV batch result has pagination token for package index ${i} ` +
            `(${packages[i]?.name}@${packages[i]?.version}) - some vulnerabilities may be missing`,
        )
      }
    }

    return { vulnerableIndices, failed: false }
  } catch (error) {
    // oxlint-disable-next-line no-console -- log OSV API failures for debugging
    console.warn(`[dep-analysis] OSV batch query failed:`, error)
    return { vulnerableIndices: [], failed: true }
  }
}

/**
 * Query OSV for full vulnerability details for a single package.
 * Only called for packages known to have vulnerabilities.
 */
async function queryOsvDetails(pkg: PackageQueryInfo): Promise<PackageVulnerabilityInfo | null> {
  try {
    const response = await $fetch<OsvQueryResponse>('https://api.osv.dev/v1/query', {
      method: 'POST',
      body: {
        package: { name: pkg.name, ecosystem: 'npm' },
        version: pkg.version,
      },
    })

    const vulns = response.vulns || []
    if (vulns.length === 0) return null

    const counts = { total: vulns.length, critical: 0, high: 0, moderate: 0, low: 0 }
    const vulnerabilities: VulnerabilitySummary[] = []

    const severityOrder: Record<OsvSeverityLevel, number> = {
      critical: 0,
      high: 1,
      moderate: 2,
      low: 3,
      unknown: 4,
    }

    const sortedVulns = [...vulns].sort(
      (a, b) => severityOrder[getSeverityLevel(a)] - severityOrder[getSeverityLevel(b)],
    )

    for (const vuln of sortedVulns) {
      const severity = getSeverityLevel(vuln)
      if (severity === 'critical') counts.critical++
      else if (severity === 'high') counts.high++
      else if (severity === 'moderate') counts.moderate++
      else if (severity === 'low') counts.low++

      vulnerabilities.push({
        id: vuln.id,
        summary: vuln.summary || 'No description available',
        severity,
        aliases: vuln.aliases || [],
        url: getVulnerabilityUrl(vuln),
        fixedIn: getFixedVersion(vuln.affected, pkg.name, pkg.version),
      })
    }

    return {
      name: pkg.name,
      version: pkg.version,
      depth: pkg.depth,
      path: pkg.path,
      vulnerabilities,
      counts,
    }
  } catch (error) {
    // oxlint-disable-next-line no-console -- log OSV API failures for debugging
    console.warn(`[dep-analysis] OSV detail query failed for ${pkg.name}@${pkg.version}:`, error)
    return null
  }
}

function getVulnerabilityUrl(vuln: OsvVulnerability): string {
  if (vuln.id.startsWith('GHSA-')) {
    return `https://github.com/advisories/${vuln.id}`
  }
  const cveAlias = vuln.aliases?.find(a => a.startsWith('CVE-'))
  if (cveAlias) {
    return `https://nvd.nist.gov/vuln/detail/${cveAlias}`
  }
  return `https://osv.dev/vulnerability/${vuln.id}`
}

/**
 * Check if a version falls within an OSV range (between introduced and fixed).
 * OSV ranges use events: introduced starts vulnerability, fixed ends it.
 */
function isVersionInRange(version: string, range: OsvRange): boolean {
  const introduced = range.events.find(e => e.introduced)?.introduced
  const fixed = range.events.find(e => e.fixed)?.fixed

  if (!introduced) return false

  // Handle "0" as "0.0.0" for semver comparison
  const introVersion = introduced === '0' ? '0.0.0' : introduced

  try {
    // Version must be >= introduced AND < fixed (if fixed exists)
    return semver.gte(version, introVersion) && (!fixed || semver.lt(version, fixed))
  } catch {
    // If semver parsing fails, skip this range
    return false
  }
}

/**
 * Extract the fixed version for a specific package version from vulnerability data.
 * Finds the range that contains the current version and returns its fixed version.
 * @see https://ossf.github.io/osv-schema/#affectedrangesevents-fields
 */
function getFixedVersion(
  affected: OsvAffected[] | undefined,
  packageName: string,
  currentVersion: string,
): string | undefined {
  if (!affected) return undefined

  // Find all affected entries for this specific package
  const packageAffectedEntries = affected.filter(
    a => a.package.ecosystem === 'npm' && a.package.name === packageName,
  )

  // Check each entry's ranges to find one that contains the current version
  for (const entry of packageAffectedEntries) {
    if (!entry.ranges) continue

    for (const range of entry.ranges) {
      // Only handle SEMVER ranges (most common for npm)
      if (range.type !== 'SEMVER') continue

      if (isVersionInRange(currentVersion, range)) {
        // Found the matching range - return its fixed version
        const fixedEvent = range.events.find(e => e.fixed)
        if (fixedEvent?.fixed) return fixedEvent.fixed
      }
    }
  }

  return undefined
}

function getSeverityLevel(vuln: OsvVulnerability): OsvSeverityLevel {
  const dbSeverity = vuln.database_specific?.severity?.toLowerCase()
  if (dbSeverity) {
    if (dbSeverity === 'critical') return 'critical'
    if (dbSeverity === 'high') return 'high'
    if (dbSeverity === 'moderate' || dbSeverity === 'medium') return 'moderate'
    if (dbSeverity === 'low') return 'low'
  }

  const severityEntry = vuln.severity?.[0]
  if (severityEntry?.score) {
    const match = severityEntry.score.match(/(?:^|[/:])(\d+(?:\.\d+)?)$/)
    if (match?.[1]) {
      const score = parseFloat(match[1])
      if (score >= 9.0) return 'critical'
      if (score >= 7.0) return 'high'
      if (score >= 4.0) return 'moderate'
      if (score > 0) return 'low'
    }
  }

  return 'unknown'
}

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

    return {
      package: name,
      version,
      vulnerablePackages,
      deprecatedPackages,
      totalPackages: packages.length,
      failedQueries,
      totalCounts,
    }
  },
  {
    maxAge: 60 * 60,
    swr: true,
    name: 'dependency-analysis',
    getKey: (name: string, version: string) => `v2:${name}@${version}`,
  },
)
