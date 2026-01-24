/**
 * OSV (Open Source Vulnerabilities) API types
 * @see https://google.github.io/osv.dev/api/
 */

/**
 * Severity level derived from CVSS score
 */
export type OsvSeverityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'unknown'

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
  counts: {
    total: number
    critical: number
    high: number
    moderate: number
    low: number
  }
}
