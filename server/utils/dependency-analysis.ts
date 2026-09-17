import type {
  DependencyDepth,
  OsvSeverityLevel,
  PackageSupplyChainInfo,
  PackageVulnerabilityInfo,
  SecuritySourceStatus,
  VulnerabilitySummary,
  VulnerabilityTreeResult,
  DeprecatedPackageInfo,
} from '#shared/types/dependency-analysis'
import { mapWithConcurrency } from '#shared/utils/async'
import { resolveDependencyTree } from './dependency-resolver'
import { queryOsvBatch, queryOsvDetails, type PackageQueryInfo } from './osv'
import {
  querySocketForTree,
  strongerReachability,
  type SocketTreeScan,
  type SocketVulnerabilityFinding,
} from './socket'
import { countBySeverity, hasTransientSourceFailure } from '#shared/utils/security-sources'
import { CACHE_MAX_AGE_FIVE_MINUTES } from '#shared/utils/constants'

/** Maximum concurrent requests for fetching vulnerability details */
const OSV_DETAIL_CONCURRENCY = 25

const DEPTH_ORDER: Record<DependencyDepth, number> = { root: 0, direct: 1, transitive: 2 }

const SEVERITY_ORDER: Record<OsvSeverityLevel, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  low: 3,
  unknown: 4,
}

/**
 * Scan the tree via OSV: batch discovery, then detail queries for packages
 * with known vulnerabilities.
 */
async function runOsvScan(packages: PackageQueryInfo[]): Promise<{
  vulnerablePackages: PackageVulnerabilityInfo[]
  failedQueries: number
  status: SecuritySourceStatus
}> {
  // Step 1: Use batch API to find which packages have vulnerabilities
  // This is much faster than individual queries - one request for all packages
  const { vulnerableIndices, failed: batchFailed } = await queryOsvBatch(packages)

  const vulnerablePackages: PackageVulnerabilityInfo[] = []
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

  const status: SecuritySourceStatus = batchFailed ? 'failed' : failedQueries > 0 ? 'partial' : 'ok'

  return { vulnerablePackages, failedQueries, status }
}

/**
 * Locate the existing entry a Socket finding refers to. Match strength is
 * evaluated across ALL entries before weakening: alias groups (e.g. OSV
 * expands aliases to the whole group) can join distinct advisories, even
 * cross-listing each other's GHSA and CVE ids - so an exact primary-id match
 * anywhere must beat any alias match, and a finding that names one GHSA must
 * never CVE-merge into an entry whose primary id is a different GHSA.
 */
function findMatchingVulnerability(
  vulnerabilities: VulnerabilitySummary[],
  finding: SocketVulnerabilityFinding,
): VulnerabilitySummary | undefined {
  // identical ids (including synthetic SOCKET-* ids) refer to the same entry
  const exact = vulnerabilities.find(vuln => vuln.id === finding.id)
  if (exact) return exact

  if (finding.ghsaId) {
    const ghsaId = finding.ghsaId
    const byGhsaId = vulnerabilities.find(vuln => vuln.id === ghsaId)
    if (byGhsaId) return byGhsaId
    const byGhsaAlias = vulnerabilities.find(vuln => vuln.aliases.includes(ghsaId))
    if (byGhsaAlias) return byGhsaAlias
  }

  if (!finding.cveId) return undefined
  const cveId = finding.cveId
  return vulnerabilities.find(
    vuln =>
      (vuln.id === cveId || vuln.aliases.includes(cveId)) &&
      !(finding.ghsaId && vuln.id.startsWith('GHSA-') && vuln.id !== finding.ghsaId),
  )
}

/**
 * Merge Socket vulnerability findings into the OSV results. Findings for the
 * same advisory (matched by GHSA/CVE id or alias) are merged into a single
 * entry tagged with both sources; Socket-only findings become new entries.
 */
function mergeSocketFindings(
  vulnerablePackages: PackageVulnerabilityInfo[],
  packagesByKey: Map<string, PackageQueryInfo>,
  socketVulnerabilities: Map<string, SocketVulnerabilityFinding[]>,
): PackageVulnerabilityInfo[] {
  const byKey = new Map(vulnerablePackages.map(pkg => [`${pkg.name}@${pkg.version}`, pkg]))

  for (const [key, findings] of socketVulnerabilities) {
    const treePackage = packagesByKey.get(key)
    // Socket may return artifacts we did not ask about (e.g. resolution
    // differences); ignore anything outside the resolved tree
    if (!treePackage) continue

    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        name: treePackage.name,
        version: treePackage.version,
        depth: treePackage.depth,
        path: treePackage.path,
        vulnerabilities: [],
        counts: { total: 0, critical: 0, high: 0, moderate: 0, low: 0 },
      }
      byKey.set(key, entry)
    }

    for (const finding of findings) {
      const existing = findMatchingVulnerability(entry.vulnerabilities, finding)
      if (existing) {
        if (!existing.sources.includes('socket')) existing.sources.push('socket')
        if (finding.reachability) {
          // multiple Socket alerts can reference the same advisory - keep
          // the strongest (most alarming) reachability verdict
          existing.reachability = strongerReachability(existing.reachability, finding.reachability)
        }
        existing.fixedIn ??= finding.fixedIn
        existing.cveId ??= finding.cveId
      } else {
        const aliases = [finding.ghsaId, finding.cveId].filter(
          (alias): alias is string => !!alias && alias !== finding.id,
        )
        entry.vulnerabilities.push({
          id: finding.id,
          summary: finding.summary,
          severity: finding.severity,
          aliases,
          cveId: finding.cveId,
          url: finding.url,
          fixedIn: finding.fixedIn,
          sources: ['socket'],
          reachability: finding.reachability,
        })
      }
    }

    entry.vulnerabilities.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
    entry.counts = countBySeverity(entry.vulnerabilities)
  }

  return [...byKey.values()]
}

/**
 * Repair alias-group pollution among a package's findings. OSV expands each
 * record's aliases to the whole transitive alias group, so two distinct
 * advisories (e.g. an original and its fix-bypass) can cross-list each
 * other's GHSA and CVE ids. Two facts let us correct this: entries here are
 * distinct advisories by their publisher's own account, so none may claim a
 * sibling's primary id as an alias; and a CVE that a source explicitly
 * paired with one advisory (cveId) cannot also alias a sibling.
 */
function reconcileAliases(vulnerabilities: VulnerabilitySummary[]): void {
  if (vulnerabilities.length < 2) return

  const primaryIds = new Set(vulnerabilities.map(vuln => vuln.id))
  // A CVE can legitimately be shared by two distinct advisories (two GHSAs,
  // one CVE), so track the full set of source-declared owners per CVE; an
  // alias is only disputed when its owner set excludes this entry entirely.
  const cveOwners = new Map<string, Set<string>>()
  for (const vuln of vulnerabilities) {
    if (vuln.cveId) {
      const owners = cveOwners.get(vuln.cveId) ?? new Set<string>()
      owners.add(vuln.id)
      cveOwners.set(vuln.cveId, owners)
    }
  }

  for (const vuln of vulnerabilities) {
    const removed: string[] = []
    vuln.aliases = vuln.aliases.filter(alias => {
      const owners = cveOwners.get(alias)
      const belongsToSibling =
        (primaryIds.has(alias) && alias !== vuln.id) ||
        (owners !== undefined && !owners.has(vuln.id))
      if (belongsToSibling) removed.push(alias)
      return !belongsToSibling
    })
    if (removed.length > 0) vuln.disputedAliases = removed
  }
}

function buildSupplyChainPackages(
  packagesByKey: Map<string, PackageQueryInfo>,
  socketAlerts: SocketTreeScan['supplyChainAlerts'],
): PackageSupplyChainInfo[] {
  const result: PackageSupplyChainInfo[] = []
  for (const [key, alerts] of socketAlerts) {
    const treePackage = packagesByKey.get(key)
    if (!treePackage || alerts.length === 0) continue
    result.push({
      name: treePackage.name,
      version: treePackage.version,
      depth: treePackage.depth,
      path: treePackage.path,
      alerts: [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]),
    })
  }

  result.sort((a, b) => {
    if (a.depth !== b.depth) return DEPTH_ORDER[a.depth] - DEPTH_ORDER[b.depth]
    const aWorst = a.alerts[0] ? SEVERITY_ORDER[a.alerts[0].severity] : Number.MAX_SAFE_INTEGER
    const bWorst = b.alerts[0] ? SEVERITY_ORDER[b.alerts[0].severity] : Number.MAX_SAFE_INTEGER
    return aWorst - bWorst
  })

  return result
}

/**
 * Analyze entire dependency tree for vulnerabilities, supply-chain alerts and
 * deprecated packages. Queries all configured security data sources (OSV
 * always; Socket when an API key is configured) and merges the findings,
 * reporting per-source status.
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

    const packagesByKey = new Map(packages.map(pkg => [`${pkg.name}@${pkg.version}`, pkg]))

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
      .sort((a, b) => DEPTH_ORDER[a.depth] - DEPTH_ORDER[b.depth])

    // Query all configured security data sources concurrently
    const [osvScan, socketScan] = await Promise.all([
      runOsvScan(packages),
      querySocketForTree(packages),
    ])

    const vulnerablePackages = mergeSocketFindings(
      osvScan.vulnerablePackages,
      packagesByKey,
      socketScan.vulnerabilities,
    )

    for (const pkg of vulnerablePackages) {
      reconcileAliases(pkg.vulnerabilities)
    }

    // Sort by depth (root → direct → transitive), then by severity
    vulnerablePackages.sort((a, b) => {
      if (a.depth !== b.depth) return DEPTH_ORDER[a.depth] - DEPTH_ORDER[b.depth]
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

    const supplyChainPackages = buildSupplyChainPackages(
      packagesByKey,
      socketScan.supplyChainAlerts,
    )

    // Log if the OSV batch query failed entirely
    if (osvScan.status === 'failed') {
      // oxlint-disable-next-line no-console -- critical error logging
      console.error(
        `[dep-analysis] Critical: OSV batch query failed for ${name}@${version} (${packages.length} packages)`,
      )
    }

    return {
      package: name,
      version,
      vulnerablePackages,
      supplyChainPackages,
      deprecatedPackages,
      totalPackages: packages.length,
      failedQueries: osvScan.failedQueries,
      totalCounts,
      sourceStatus: { osv: osvScan.status, socket: socketScan.status },
    }
  },
  {
    maxAge: 60 * 60,
    swr: true,
    name: 'dependency-analysis',
    getKey: (name: string, version: string) => `v4:${name}@${version}`,
    // Results degraded by a transient source failure (outage, quota
    // exhaustion) are only served from cache briefly, so a blip doesn't
    // strip findings from the cache for a whole hour after recovery
    validate: entry => {
      // a custom validate replaces nitro's default entry.value !== undefined guard
      const result = entry.value
      if (!result) return false
      if (!hasTransientSourceFailure(result.sourceStatus)) return true
      return Date.now() - (entry.mtime ?? 0) < CACHE_MAX_AGE_FIVE_MINUTES * 1000
    },
  },
)
