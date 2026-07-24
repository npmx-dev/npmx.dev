/**
 * Dependency Analysis Types
 * Types for vulnerability scanning (via OSV API) and deprecated package detection.
 *
 * @see https://google.github.io/osv.dev/api/
 */

/**
 * Identifier for a security data source that can report vulnerabilities
 */
export type SecuritySourceId = 'osv' | 'socket'

/**
 * Fetch status for a single security data source:
 * - `ok`: all queries succeeded
 * - `partial`: some queries failed; results may be incomplete
 * - `failed`: the source could not be queried at all
 * - `unconfigured`: the source needs server-side configuration (e.g. an API
 *   key) that this deployment does not have
 * - `unavailable`: the source is configured but temporarily out of service
 *   (e.g. quota exhausted)
 */
export type SecuritySourceStatus = 'ok' | 'partial' | 'failed' | 'unconfigured' | 'unavailable'

/**
 * Socket reachability analysis verdict for a vulnerability: whether the
 * vulnerable code is actually reachable from the package's entry points
 */
export type VulnerabilityReachability = 'reachable' | 'maybe_reachable' | 'unreachable'

/**
 * Severity levels in priority order (highest first)
 */
export const SEVERITY_LEVELS = ['critical', 'high', 'moderate', 'low'] as const

/**
 * Severity level derived from CVSS score
 */
export type OsvSeverityLevel = (typeof SEVERITY_LEVELS)[number] | 'unknown'

/**
 * Counts by severity level
 */
export type SeverityCounts = Record<(typeof SEVERITY_LEVELS)[number], number>

/**
 * CVSS severity information from OSV
 */
export interface OsvSeverity {
  type: 'CVSS_V3' | 'CVSS_V4'
  score: string
}

/**
 * Reference link for a vulnerability
 */
export interface OsvReference {
  type: 'ADVISORY' | 'WEB' | 'PACKAGE' | 'REPORT' | 'FIX' | 'ARTICLE' | 'DETECTION' | 'EVIDENCE'
  url: string
}

/**
 * Version range event from OSV affected data
 * @see https://ossf.github.io/osv-schema/#affectedrangesevents-fields
 */
export interface OsvRangeEvent {
  introduced?: string
  fixed?: string
  last_affected?: string
  limit?: string
}

/**
 * Version range from OSV affected data
 */
export interface OsvRange {
  type: 'SEMVER' | 'ECOSYSTEM' | 'GIT'
  events: OsvRangeEvent[]
}

/**
 * Affected package info from OSV
 */
export interface OsvAffected {
  package: {
    ecosystem: string
    name: string
  }
  ranges?: OsvRange[]
  versions?: string[]
}

/**
 * Individual vulnerability record from OSV
 */
export interface OsvVulnerability {
  id: string
  summary?: string
  details?: string
  aliases?: string[]
  modified: string
  published?: string
  severity?: OsvSeverity[]
  references?: OsvReference[]
  affected?: OsvAffected[]
  database_specific?: {
    severity?: string
    cwe_ids?: string[]
    github_reviewed?: boolean
    nvd_published_at?: string
  }
}

/**
 * OSV API query response
 */
export interface OsvQueryResponse {
  vulns?: OsvVulnerability[]
  next_page_token?: string
}

/**
 * Single result from OSV batch query (minimal info - just ID and modified)
 */
export interface OsvBatchVulnRef {
  id: string
  modified: string
}

/**
 * Single result in OSV batch response
 */
export interface OsvBatchResult {
  vulns?: OsvBatchVulnRef[]
  next_page_token?: string
}

/**
 * OSV batch query response
 * @see https://google.github.io/osv.dev/post-v1-querybatch/
 */
export interface OsvBatchResponse {
  results: OsvBatchResult[]
}

/**
 * Simplified vulnerability info for display
 */
export interface VulnerabilitySummary {
  id: string
  summary: string
  severity: OsvSeverityLevel
  aliases: string[]
  /**
   * CVE id paired one-to-one with this advisory by a source's own record.
   * Alias lists can span multiple distinct advisories (e.g. OSV expands
   * aliases to the whole alias group), so this is the only trustworthy
   * GHSA-to-CVE pairing when `aliases` contains several CVEs.
   */
  cveId?: string
  /**
   * Ids the source listed as aliases of this advisory but that provably
   * belong to a sibling advisory (upstream alias-group pollution). Removed
   * from `aliases`; kept here so the UI can attribute the bad data to the
   * source that supplied it.
   */
  disputedAliases?: string[]
  url: string
  /** Version that fixes this vulnerability (if known) */
  fixedIn?: string
  /** Security data sources that reported this vulnerability */
  sources: SecuritySourceId[]
  /** Socket reachability analysis verdict, when available */
  reachability?: VulnerabilityReachability
}

/**
 * Socket supply-chain alert types surfaced by npmx (curated subset)
 */
export type SupplyChainAlertType =
  | 'malware'
  | 'gptMalware'
  | 'didYouMean'
  | 'gptDidYouMean'
  | 'troll'
  | 'obfuscatedFile'
  | 'manifestConfusion'
  | 'installScripts'
  | 'telemetry'
  | 'unstableOwnership'

/**
 * A single supply-chain risk alert for a package
 */
export interface SupplyChainAlert {
  /** Alert type key (curated subset of Socket alert types) */
  type: SupplyChainAlertType
  severity: OsvSeverityLevel
  /** URL with more detail (socket.dev package page) */
  url: string
  /** Security data sources that reported this alert */
  sources: SecuritySourceId[]
}

/**
 * Supply-chain alerts for a single package in the tree
 */
export interface PackageSupplyChainInfo {
  name: string
  version: string
  /** Depth in dependency tree: root (0), direct (1), transitive (2+) */
  depth: DependencyDepth
  /** Dependency path from root package */
  path: string[]
  alerts: SupplyChainAlert[]
}

/**
 * Package vulnerability response returned by our API
 */
export interface PackageVulnerabilities {
  package: string
  version: string
  vulnerabilities: VulnerabilitySummary[]
  counts: SeverityCounts & { total: number }
}

/** Depth in dependency tree */
export type DependencyDepth = 'root' | 'direct' | 'transitive'

/**
 * Vulnerability info for a single package in the tree
 */
export interface PackageVulnerabilityInfo {
  name: string
  version: string
  /** Depth in dependency tree: root (0), direct (1), transitive (2+) */
  depth: DependencyDepth
  /** Dependency path from root package */
  path: string[]
  vulnerabilities: VulnerabilitySummary[]
  counts: {
    total: number
    critical: number
    high: number
    moderate: number
    low: number
  }
}

/**
 * Deprecated package info in the dependency tree
 */
export interface DeprecatedPackageInfo {
  name: string
  version: string
  /** Depth in dependency tree: root (0), direct (1), transitive (2+) */
  depth: DependencyDepth
  /** Dependency path from root package */
  path: string[]
  /** Deprecation message */
  message: string
}

/**
 * Result of dependency tree analysis
 */
export interface VulnerabilityTreeResult {
  /** Root package name */
  package: string
  /** Root package version */
  version: string
  /** All packages with vulnerabilities in the tree */
  vulnerablePackages: PackageVulnerabilityInfo[]
  /** All packages with supply-chain alerts in the tree */
  supplyChainPackages: PackageSupplyChainInfo[]
  /** All deprecated packages in the tree */
  deprecatedPackages: DeprecatedPackageInfo[]
  /** Total packages analyzed */
  totalPackages: number
  /** Number of packages that could not be checked (OSV query failed) */
  failedQueries: number
  /** Per-source fetch status for the security data sources that were queried */
  sourceStatus: Record<SecuritySourceId, SecuritySourceStatus>
  /** Aggregated counts across all packages */
  totalCounts: {
    total: number
    critical: number
    high: number
    moderate: number
    low: number
  }
}
