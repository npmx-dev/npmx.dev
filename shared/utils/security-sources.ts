import type {
  PackageVulnerabilityInfo,
  SecuritySourceId,
  SecuritySourceStatus,
  VulnerabilitySummary,
  VulnerabilityTreeResult,
} from '../types/dependency-analysis'
import { SEVERITY_LEVELS } from '../types/dependency-analysis'

/** All known security data sources, in display order */
export const SECURITY_SOURCE_IDS = ['osv', 'socket'] as const satisfies readonly SecuritySourceId[]

/** socket.dev package page for a given npm package (also the attribution link) */
export function getSocketPackageUrl(packageName: string): string {
  return `https://socket.dev/npm/package/${packageName}`
}

/**
 * Whether none of the user's enabled security data sources produced any
 * data, meaning the displayed (source-filtered) result carries no
 * vulnerability information at all. Sources that failed, are unconfigured,
 * or are temporarily unavailable carry no data; a source only counts as
 * informative if it succeeded (fully or partially) AND the user has it
 * enabled - an 'ok' status from a disabled source must not mask a failure
 * of the only enabled one. Callers should treat an uninformative result as
 * "could not check" rather than "no vulnerabilities". Returns `false` when
 * no source is enabled at all; callers handle the nothing-enabled state
 * separately.
 */
export function noEnabledSecuritySourceHasData(
  sourceStatus: Partial<Record<SecuritySourceId, SecuritySourceStatus>>,
  enabledSources: Partial<Record<SecuritySourceId, boolean>>,
): boolean {
  const relevant = Object.entries(sourceStatus).filter(
    ([source]) => enabledSources[source as SecuritySourceId],
  )
  return (
    relevant.length > 0 && !relevant.some(([, status]) => status === 'ok' || status === 'partial')
  )
}

/**
 * Whether a specific source actually produced data (fully or partially).
 * A source that is unconfigured, unavailable, or failed carries no data, so
 * its findings (e.g. Socket-only supply-chain alerts) must render as
 * "could not check" rather than a reassuring zero.
 */
export function securitySourceHasData(
  sourceStatus: Partial<Record<SecuritySourceId, SecuritySourceStatus>>,
  source: SecuritySourceId,
): boolean {
  const status = sourceStatus[source]
  return status === 'ok' || status === 'partial'
}

/**
 * Whether any source failed for a (possibly transient) reason - an outage,
 * quota exhaustion, or a partially-completed scan. Used to cache such results
 * for a much shorter time than complete ones, so a blip doesn't strip
 * findings from caches for an hour. `unconfigured` is deliberately excluded:
 * it is a stable deployment state.
 */
export function hasTransientSourceFailure(
  sourceStatus: Partial<Record<SecuritySourceId, SecuritySourceStatus>>,
): boolean {
  return Object.values(sourceStatus).some(
    status => status === 'failed' || status === 'unavailable' || status === 'partial',
  )
}

/**
 * Pick the findings for a collapsed preview. Severity order is kept, but
 * every source that reported a finding is guaranteed a representative
 * (a merged finding represents all of its sources), so a short preview
 * cannot read as "only one source found problems".
 */
export function selectPreviewVulnerabilities(
  vulnerabilities: VulnerabilitySummary[],
  limit: number,
): VulnerabilitySummary[] {
  if (vulnerabilities.length <= limit) return vulnerabilities

  const picked = new Set<VulnerabilitySummary>()
  const uncovered = new Set(vulnerabilities.flatMap(vuln => vuln.sources))
  for (const vuln of vulnerabilities) {
    if (picked.size >= limit) break
    if (vuln.sources.some(source => uncovered.has(source))) {
      picked.add(vuln)
      for (const source of vuln.sources) uncovered.delete(source)
    }
  }
  for (const vuln of vulnerabilities) {
    if (picked.size >= limit) break
    picked.add(vuln)
  }
  return vulnerabilities.filter(vuln => picked.has(vuln))
}

/** Count vulnerabilities by severity level ('unknown' contributes only to the total) */
export function countBySeverity(
  vulnerabilities: PackageVulnerabilityInfo['vulnerabilities'],
): PackageVulnerabilityInfo['counts'] {
  const counts = { total: vulnerabilities.length, critical: 0, high: 0, moderate: 0, low: 0 }
  for (const vuln of vulnerabilities) {
    if (vuln.severity !== 'unknown') counts[vuln.severity]++
  }
  return counts
}

/**
 * Filter a vulnerability tree down to findings reported by at least one
 * enabled security data source, recomputing per-package and total counts.
 * This is a pure display filter: deprecated packages and scan metadata are
 * passed through unchanged.
 */
export function filterVulnerabilityTreeBySources(
  tree: VulnerabilityTreeResult,
  enabledSources: Partial<Record<SecuritySourceId, boolean>>,
): VulnerabilityTreeResult {
  const vulnerablePackages = tree.vulnerablePackages
    .map(pkg => {
      const vulnerabilities = pkg.vulnerabilities.filter(vuln =>
        vuln.sources.some(source => enabledSources[source]),
      )
      if (vulnerabilities.length === pkg.vulnerabilities.length) return pkg
      return { ...pkg, vulnerabilities, counts: countBySeverity(vulnerabilities) }
    })
    .filter(pkg => pkg.vulnerabilities.length > 0)

  const totalCounts = { total: 0, critical: 0, high: 0, moderate: 0, low: 0 }
  for (const pkg of vulnerablePackages) {
    totalCounts.total += pkg.counts.total
    for (const severity of SEVERITY_LEVELS) {
      totalCounts[severity] += pkg.counts[severity]
    }
  }

  const supplyChainPackages = tree.supplyChainPackages
    .map(pkg => {
      const alerts = pkg.alerts.filter(alert =>
        alert.sources.some(source => enabledSources[source]),
      )
      if (alerts.length === pkg.alerts.length) return pkg
      return { ...pkg, alerts }
    })
    .filter(pkg => pkg.alerts.length > 0)

  return { ...tree, vulnerablePackages, supplyChainPackages, totalCounts }
}
