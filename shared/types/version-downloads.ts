/**
 * Version Downloads Distribution Types
 * Types for version download statistics and grouping.
 *
 * These types support fetching per-version download counts from npm API
 * and grouping them by major/minor versions for distribution analysis.
 */

/**
 * Download data for a single package version
 */
export interface VersionDownloadPoint {
  /** Semantic version string (e.g., "1.2.3") */
  version: string
  /** Download count for this version */
  downloads: number
  /** Percentage of total downloads (0-100) */
  percentage: number
}

/**
 * Aggregated download data for a version group (major or minor)
 */
export interface VersionGroupDownloads {
  /** Group identifier (e.g., "1.x" for major, "1.2.x" for minor) */
  groupKey: string
  /** Human-readable label (e.g., "v1.x", "v1.2.x") */
  label: string
  /** Total downloads for all versions in this group */
  downloads: number
  /** Percentage of total downloads (0-100) */
  percentage: number
  /** Individual versions in this group */
  versions: VersionDownloadPoint[]
}

/**
 * Mode for grouping versions
 * - 'major': Group by major version (1.x, 2.x)
 * - 'minor': Group by minor version (1.2.x, 1.3.x)
 */
export type VersionGroupingMode = 'major' | 'minor'

/**
 * API response for version download distribution
 */
export interface VersionDistributionResponse {
  /** Package name */
  package: string
  /** Grouping mode used */
  mode: VersionGroupingMode
  /** Total downloads across all versions */
  totalDownloads: number
  /** Grouped version data */
  groups: VersionGroupDownloads[]
  /** ISO 8601 timestamp when data was fetched */
  timestamp: string
  /** List of version strings published within the last year (only present when filterOldVersions=true) */
  recentVersions?: string[]
}
