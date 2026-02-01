/**
 * Dependency Analysis Types
 * Types for vulnerability scanning (via OSV API) and deprecated package detection.
 *
 * @see https://google.github.io/osv.dev/api/
 */

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
 * Simplified vulnerability info for display
 */
export interface VulnerabilitySummary {
  id: string
  summary: string
  severity: OsvSeverityLevel
  aliases: string[]
  url: string
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
  /** All deprecated packages in the tree */
  deprecatedPackages: DeprecatedPackageInfo[]
  /** Total packages analyzed */
  totalPackages: number
  /** Number of packages that could not be checked (OSV query failed) */
  failedQueries: number
  /** Aggregated counts across all packages */
  totalCounts: {
    total: number
    critical: number
    high: number
    moderate: number
    low: number
  }
}
