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
} from '#shared/types/dependency-analysis'
import { resolveDependencyTree } from './dependency-resolver'

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
    const packages: PackageQueryInfo[] = [...resolved.values()].map(pkg => ({
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
      const vulnerablePackageInfos = vulnerableIndices.map(i => packages[i]!)

      const detailResults = await Promise.all(
        vulnerablePackageInfos.map(pkg => queryOsvDetails(pkg)),
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
