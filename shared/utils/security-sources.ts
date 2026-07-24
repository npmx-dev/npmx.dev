import type {
  PackageVulnerabilityInfo,
  SecuritySourceId,
  SecuritySourceStatus,
  VulnerabilityTreeResult,
} from '../types/dependency-analysis'
import { SEVERITY_LEVELS } from '../types/dependency-analysis'

/** All known security data sources, in display order */
export const SECURITY_SOURCE_IDS = ['osv'] as const satisfies readonly SecuritySourceId[]

/**
 * Whether none of the user's enabled security data sources produced any
 * data, meaning the displayed (source-filtered) result carries no
 * vulnerability information at all. A source only counts as informative if
 * it succeeded (fully or partially) AND the user has it enabled - an 'ok'
 * status from a disabled source must not mask a failure of the only enabled
 * one. Callers should treat an uninformative result as "could not check"
 * rather than "no vulnerabilities". Returns `false` when no source is
 * enabled at all; callers handle the nothing-enabled state separately.
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
 * Whether any source failed for a (possibly transient) reason, e.g. an
 * outage. Used to cache such results for a much shorter time than complete
 * ones, so a blip doesn't strip findings from caches for an hour.
 */
export function hasTransientSourceFailure(
  sourceStatus: Partial<Record<SecuritySourceId, SecuritySourceStatus>>,
): boolean {
  return Object.values(sourceStatus).some(status => status === 'failed')
}

function countBySeverity(
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

  return { ...tree, vulnerablePackages, totalCounts }
}
