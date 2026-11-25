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
  DirectDependencyHealthResult,
  OsvAffected,
} from '#shared/types/dependency-analysis'
import { mapWithConcurrency } from '#shared/utils/async'
import { resolveDependencyTree, resolveVersion } from './dependency-resolver'
import { isExcludedByLastKnownAffectedRange, parseRangeIntervals } from './osv'
import { compare, isGreaterOrEqual, isLess } from 'verkit'

/** Maximum concurrent requests for fetching vulnerability details */
const OSV_DETAIL_CONCURRENCY = 25

/** OSV rejects querybatch requests with more than 1000 queries */
const OSV_BATCH_MAX_QUERIES = 1000

/** Maximum concurrent querybatch requests */
const OSV_BATCH_CONCURRENCY = 3

/** Bound on paginated querybatch requests per chunk */
const OSV_BATCH_MAX_PAGES = 5

/** Package info needed for OSV queries */
interface PackageQueryInfo {
  name: string
  version: string
  depth: DependencyDepth
  path: string[]
}

/**
 * Query a single OSV batch chunk, following per-query pagination tokens.
 * Returns indices within the chunk that have vulnerabilities, plus the number of
 * queries left without a result because a request failed.
 * @see https://google.github.io/osv.dev/post-v1-querybatch/
 */
async function queryOsvBatchChunk(
  packages: PackageQueryInfo[],
): Promise<{ vulnerableIndices: number[]; failedQueries: number }> {
  const vulnerableIndices = new Set<number>()
  let pending: Array<{ index: number; pageToken?: string }> = packages.map((_, index) => ({
    index,
  }))

  try {
    for (let page = 0; pending.length > 0; page++) {
      if (page >= OSV_BATCH_MAX_PAGES) {
        // oxlint-disable-next-line no-console -- warn about paginated results
        console.warn(
          `[dep-analysis] OSV batch results still paginated after ${OSV_BATCH_MAX_PAGES} pages ` +
            `for ${pending.length} queries - some vulnerabilities may be missing`,
        )
        break
      }

      const response = await $fetch<OsvBatchResponse>('https://api.osv.dev/v1/querybatch', {
        method: 'POST',
        body: {
          queries: pending.map(({ index, pageToken }) => {
            const pkg = packages[index]!
            return {
              package: { name: pkg.name, ecosystem: 'npm' },
              version: pkg.version,
              ...(pageToken ? { page_token: pageToken } : {}),
            }
          }),
        },
      })

      const next: typeof pending = []
      for (const [queryIndex, entry] of pending.entries()) {
        const result = response.results[queryIndex]
        if (result?.vulns && result.vulns.length > 0) {
          vulnerableIndices.add(entry.index)
        }
        if (result?.next_page_token) {
          next.push({ index: entry.index, pageToken: result.next_page_token })
        }
      }
      pending = next
    }

    return { vulnerableIndices: [...vulnerableIndices].sort((a, b) => a - b), failedQueries: 0 }
  } catch (error) {
    // oxlint-disable-next-line no-console -- log OSV API failures for debugging
    console.warn(`[dep-analysis] OSV batch query failed:`, error)
    return {
      vulnerableIndices: [...vulnerableIndices].sort((a, b) => a - b),
      failedQueries: pending.filter(({ index }) => !vulnerableIndices.has(index)).length,
    }
  }
}

/**
 * Query OSV batch API to find which packages have vulnerabilities.
 * Returns indices of packages that have vulnerabilities (for follow-up detailed queries),
 * plus the number of packages whose batch query failed.
 */
async function queryOsvBatch(
  packages: PackageQueryInfo[],
): Promise<{ vulnerableIndices: number[]; failedPackages: number }> {
  if (packages.length === 0) return { vulnerableIndices: [], failedPackages: 0 }

  const chunks: PackageQueryInfo[][] = []
  for (let offset = 0; offset < packages.length; offset += OSV_BATCH_MAX_QUERIES) {
    chunks.push(packages.slice(offset, offset + OSV_BATCH_MAX_QUERIES))
  }

  const chunkResults = await mapWithConcurrency(chunks, queryOsvBatchChunk, OSV_BATCH_CONCURRENCY)

  const vulnerableIndices: number[] = []
  let failedPackages = 0

  for (const [chunkIndex, result] of chunkResults.entries()) {
    failedPackages += result.failedQueries
    const offset = chunkIndex * OSV_BATCH_MAX_QUERIES
    vulnerableIndices.push(...result.vulnerableIndices.map(index => offset + index))
  }

  return { vulnerableIndices, failedPackages }
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

    if (!response.vulns?.length) return null
    const vulns = response.vulns.filter(
      vuln => !isExcludedByLastKnownAffectedRange(vuln, pkg.name, pkg.version),
    )

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
 * Extract the fixed version for a specific package version from vulnerability data.
 * Finds all intervals that contain the current version and returns the closest fix,
 * preferring a nearby backport over a distant major-version bump.
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

  // Collect all matching fixed versions across all ranges
  const matchingFixedVersions: string[] = []

  for (const entry of packageAffectedEntries) {
    if (!entry.ranges) continue

    for (const range of entry.ranges) {
      // Only handle SEMVER ranges (most common for npm)
      if (range.type !== 'SEMVER') continue

      const intervals = parseRangeIntervals(range)
      for (const interval of intervals) {
        const introVersion = interval.introduced === '0' ? '0.0.0' : interval.introduced
        try {
          const afterIntro = isGreaterOrEqual(currentVersion, introVersion)
          const beforeFixed = !interval.fixed || isLess(currentVersion, interval.fixed)
          if (afterIntro && beforeFixed && interval.fixed) {
            matchingFixedVersions.push(interval.fixed)
          }
        } catch {
          continue
        }
      }
    }
  }

  if (matchingFixedVersions.length === 0) return undefined
  if (matchingFixedVersions.length === 1) return matchingFixedVersions[0]

  // Return the lowest (closest) fixed version — the smallest bump from the current version
  return matchingFixedVersions.sort(compare)[0]
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
    // This is much faster than individual queries - a request per 1000 packages
    const { vulnerableIndices, failedPackages } = await queryOsvBatch(packages)

    let vulnerablePackages: PackageVulnerabilityInfo[] = []
    let failedQueries = failedPackages

    if (vulnerableIndices.length > 0) {
      // Step 2: Fetch full vulnerability details only for packages with vulns
      // This is typically a small fraction of total packages
      const detailResults = await mapWithConcurrency(
        vulnerableIndices,
        i => queryOsvDetails(packages[i]!),
        OSV_DETAIL_CONCURRENCY,
      )

      for (const result of detailResults) {
        if (!result) {
          failedQueries++
        } else if (result.counts.total > 0) {
          vulnerablePackages.push(result)
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
    if (packages.length > 0 && failedPackages === packages.length) {
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

const DIRECT_DEPS_RESOLVE_CONCURRENCY = 20

export async function analyzeDirectDependencyHealth(
  dependencies: Record<string, string>,
): Promise<DirectDependencyHealthResult> {
  const entries = Object.entries(dependencies)
  const resolved = await mapWithConcurrency(
    entries,
    async ([name, range]) => {
      try {
        const packument = await fetchNpmPackageAbbreviated(name)
        const versions = Object.keys(packument.versions)
        const version = packument['dist-tags']?.[range] ?? resolveVersion(range, versions)
        if (!version) return null

        const versionData = packument.versions[version]
        if (!versionData) return null

        return {
          name,
          version,
          deprecated: versionData?.deprecated,
        }
      } catch {
        return null
      }
    },
    DIRECT_DEPS_RESOLVE_CONCURRENCY,
  )

  const packages: PackageQueryInfo[] = []
  const deprecated: DirectDependencyHealthResult['deprecated'] = {}

  for (const pkg of resolved) {
    if (!pkg) continue
    packages.push({
      name: pkg.name,
      version: pkg.version,
      depth: 'direct',
      path: [],
    })
    if (pkg.deprecated) {
      deprecated[pkg.name] = {
        name: pkg.name,
        version: pkg.version,
        message: pkg.deprecated,
      }
    }
  }

  const vulnerable: DirectDependencyHealthResult['vulnerable'] = {}

  if (packages.length === 0) {
    return { vulnerable, deprecated }
  }

  const { vulnerableIndices } = await queryOsvBatch(packages)
  if (vulnerableIndices.length === 0) {
    return { vulnerable, deprecated }
  }

  const detailResults = await mapWithConcurrency(
    vulnerableIndices,
    i => queryOsvDetails(packages[i]!),
    OSV_DETAIL_CONCURRENCY,
  )

  for (const result of detailResults) {
    if (!result?.counts.total) continue
    vulnerable[result.name] = {
      name: result.name,
      version: result.version,
      counts: result.counts,
    }
  }

  return { vulnerable, deprecated }
}
