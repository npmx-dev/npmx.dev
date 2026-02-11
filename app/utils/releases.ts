import type { Release } from '~/composables/useRepoMeta'

/**
 * Match an npm version string to a repository release.
 * Handles various tag formats: "v1.0.0", "1.0.0", "release-1.0.0", etc.
 *
 * @param version - npm version string (e.g., "1.2.3", "0.9.0-beta.1")
 * @param releases - Array of releases from repository
 * @returns Matched release or null
 */
export function getMatchedRelease(version: string, releases: Release[]): Release | null {
  if (!version || !releases.length) return null

  // Normalize version for comparison (remove any existing 'v' prefix)
  const normalizedVersion = version.replace(/^v/, '').toLowerCase()

  // Try exact matches with common tag formats
  const tagVariants = [
    `v${normalizedVersion}`, // Most common: v1.0.0
    normalizedVersion, // Without prefix: 1.0.0
    `release-${normalizedVersion}`, // Some projects: release-1.0.0
    `${normalizedVersion}-release`, // Alternative: 1.0.0-release
  ]

  for (const release of releases) {
    if (!release.url) continue
    const releaseTag = release.tag.toLowerCase()

    // Check each variant (case-insensitive)
    for (const variant of tagVariants) {
      if (releaseTag === variant) {
        return release
      }
    }
  }

  return null
}
