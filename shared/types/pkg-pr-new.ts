/**
 * pkg.pr.new availability response for our API
 * Indicates whether a GitHub repository publishes preview releases
 */
export interface PkgPrNewAvailability {
  /** Whether pkg.pr.new has preview releases for the repository */
  hasReleases: boolean
  /** pkg.pr.new page listing the repository's preview releases */
  url: string
}
