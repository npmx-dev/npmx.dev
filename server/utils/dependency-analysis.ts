import type {
  OsvQueryResponse,
  OsvVulnerability,
  OsvSeverityLevel,
  VulnerabilitySummary,
  DependencyDepth,
  PackageVulnerabilityInfo,
  VulnerabilityTreeResult,
  DeprecatedPackageInfo,
} from '#shared/types/dependency-analysis'
import { resolveDependencyTree } from './dependency-resolver'

/** Result of a single OSV query */
type OsvQueryResult = { status: 'ok'; data: PackageVulnerabilityInfo | null } | { status: 'error' }

/**
 * Query OSV for vulnerabilities in a package
 */
async function queryOsv(
  name: string,
  version: string,
  depth: DependencyDepth,
  path: string[],
): Promise<OsvQueryResult> {
  try {
    const response = await $fetch<OsvQueryResponse>('https://api.osv.dev/v1/query', {
      method: 'POST',
      body: {
        package: { name, ecosystem: 'npm' },
        version,
      },
    })

    const vulns = response.vulns || []
    if (vulns.length === 0) return { status: 'ok', data: null }

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

    return { status: 'ok', data: { name, version, depth, path, vulnerabilities, counts } }
  } catch (error) {
    // oxlint-disable-next-line no-console -- log OSV API failures for debugging
    console.warn(`[dep-analysis] OSV query failed for ${name}@${version}:`, error)
    return { status: 'error' }
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
 */
export const analyzeDependencyTree = defineCachedFunction(
  async (name: string, version: string): Promise<VulnerabilityTreeResult> => {
    // Resolve all packages in the tree with depth tracking
    const resolved = await resolveDependencyTree(name, version, { trackDepth: true })

    // Convert to array for OSV querying
    const packages = [...resolved.values()]

    // Collect deprecated packages (no API call needed - already in packument data)
    const deprecatedPackages: DeprecatedPackageInfo[] = packages
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

    // Query OSV for all packages in parallel batches
    const vulnerablePackages: PackageVulnerabilityInfo[] = []
    let failedQueries = 0
    const batchSize = 10

    for (let i = 0; i < packages.length; i += batchSize) {
      const batch = packages.slice(i, i + batchSize)
      const results = await Promise.all(
        batch.map(pkg => queryOsv(pkg.name, pkg.version, pkg.depth!, pkg.path || [])),
      )

      for (const result of results) {
        if (result.status === 'error') {
          failedQueries++
        } else if (result.data) {
          vulnerablePackages.push(result.data)
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

    // Log critical failures (>50% of queries failed)
    if (failedQueries > 0 && failedQueries > packages.length / 2) {
      // oxlint-disable-next-line no-console -- critical error logging
      console.error(
        `[dep-analysis] Critical: ${failedQueries}/${packages.length} OSV queries failed for ${name}@${version}`,
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
    getKey: (name: string, version: string) => `v1:${name}@${version}`,
  },
)
