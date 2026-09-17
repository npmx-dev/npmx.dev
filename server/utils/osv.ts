import type {
  OsvQueryResponse,
  OsvBatchResponse,
  OsvVulnerability,
  OsvSeverityLevel,
  VulnerabilitySummary,
  DependencyDepth,
  PackageVulnerabilityInfo,
  OsvAffected,
  OsvRange,
} from '#shared/types/dependency-analysis'
import { compare, isGreaterOrEqual, isLess } from 'verkit'

const OSV_QUERY_API = 'https://api.osv.dev/v1/query'
const OSV_QUERY_BATCH_API = 'https://api.osv.dev/v1/querybatch'

// a stalled OSV connection would otherwise hang the whole security scan until
// the platform request limit fires; degrade to the failed-source path instead
const OSV_FETCH_TIMEOUT_MS = 10_000

/** Package info needed for OSV queries */
export interface PackageQueryInfo {
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
export async function queryOsvBatch(
  packages: PackageQueryInfo[],
): Promise<{ vulnerableIndices: number[]; failed: boolean }> {
  if (packages.length === 0) return { vulnerableIndices: [], failed: false }

  try {
    const response = await $fetch<OsvBatchResponse>(OSV_QUERY_BATCH_API, {
      method: 'POST',
      timeout: OSV_FETCH_TIMEOUT_MS,
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
export async function queryOsvDetails(
  pkg: PackageQueryInfo,
): Promise<PackageVulnerabilityInfo | null> {
  try {
    const response = await $fetch<OsvQueryResponse>(OSV_QUERY_API, {
      method: 'POST',
      timeout: OSV_FETCH_TIMEOUT_MS,
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
        sources: ['osv'],
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

/**
 * Fetch the number of known vulnerabilities for a single package version.
 * Returns `null` (not 0) when the OSV query fails, so callers can distinguish
 * "no known vulnerabilities" from "could not check".
 */
export async function fetchOsvVulnerabilityCount(
  name: string,
  version: string,
): Promise<number | null> {
  try {
    const response = await $fetch<OsvQueryResponse>(OSV_QUERY_API, {
      method: 'POST',
      timeout: OSV_FETCH_TIMEOUT_MS,
      body: {
        package: { name, ecosystem: 'npm' },
        version,
      },
    })
    return response.vulns?.length ?? 0
  } catch (error) {
    // oxlint-disable-next-line no-console -- log OSV API failures for debugging
    console.warn(`[osv] vulnerability count query failed for ${name}@${version}:`, error)
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
 * Parse OSV range events into introduced/fixed pairs.
 * OSV events form a timeline: [introduced, fixed, introduced, fixed, ...]
 * A single range can have multiple introduced/fixed pairs representing
 * periods where the vulnerability was active, was fixed, and was reintroduced.
 * @see https://ossf.github.io/osv-schema/#affectedrangesevents-fields
 */
function parseRangeIntervals(range: OsvRange): Array<{ introduced: string; fixed?: string }> {
  const intervals: Array<{ introduced: string; fixed?: string }> = []
  let currentIntroduced: string | undefined

  for (const event of range.events) {
    if (event.introduced !== undefined) {
      // Start a new interval (close previous open one if any)
      if (currentIntroduced !== undefined) {
        intervals.push({ introduced: currentIntroduced })
      }
      currentIntroduced = event.introduced
    } else if (event.fixed !== undefined && currentIntroduced !== undefined) {
      intervals.push({ introduced: currentIntroduced, fixed: event.fixed })
      currentIntroduced = undefined
    }
  }

  // Handle trailing introduced with no fixed (still vulnerable)
  if (currentIntroduced !== undefined) {
    intervals.push({ introduced: currentIntroduced })
  }

  return intervals
}

/**
 * OSV SEMVER events sometimes carry shorthand versions (e.g. introduced
 * "13.0" or "0"); pad the missing parts so semver comparisons don't reject
 * the whole interval.
 */
function coerceSemver(version: string): string {
  const parts = version.split('.')
  while (parts.length < 3) parts.push('0')
  return parts.join('.')
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
        const introVersion = coerceSemver(interval.introduced)
        const fixedVersion = interval.fixed ? coerceSemver(interval.fixed) : undefined
        try {
          const afterIntro = isGreaterOrEqual(currentVersion, introVersion)
          const beforeFixed = !fixedVersion || isLess(currentVersion, fixedVersion)
          if (afterIntro && beforeFixed && fixedVersion) {
            matchingFixedVersions.push(fixedVersion)
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
