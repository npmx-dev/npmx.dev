import { compare, valid } from 'semver'

/**
 * Utilities for handling npm package versions and dist-tags
 */

/**
 * Check if a version string is an exact semver version.
 * Returns true for "1.2.3", "1.0.0-beta.1", etc.
 * Returns false for ranges like "^1.2.3", ">=1.0.0", tags like "latest", etc.
 * @param version - The version string to check
 * @returns true if the version is an exact semver version
 */
export function isExactVersion(version: string): boolean {
  return valid(version) !== null
}

/** Parsed semver version components */
export interface ParsedVersion {
  major: number
  minor: number
  patch: number
  prerelease: string
}

/**
 * Parse a semver version string into its components
 * @param version - The version string (e.g., "1.2.3" or "1.0.0-beta.1")
 * @returns Parsed version object with major, minor, patch, and prerelease
 */
export function parseVersion(version: string): ParsedVersion {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?/)
  if (!match) return { major: 0, minor: 0, patch: 0, prerelease: '' }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? '',
  }
}

/**
 * Extract the prerelease channel from a version string
 * @param version - The version string (e.g., "1.0.0-beta.1")
 * @returns The channel name (e.g., "beta") or empty string for stable versions
 */
export function getPrereleaseChannel(version: string): string {
  const parsed = parseVersion(version)
  if (!parsed.prerelease) return ''
  const match = parsed.prerelease.match(/^([a-z]+)/i)
  return match ? match[1]!.toLowerCase() : ''
}

/**
 * Sort tags with 'latest' first, then alphabetically
 * @param tags - Array of tag names
 * @returns New sorted array
 */
export function sortTags(tags: string[]): string[] {
  return [...tags].sort((a, b) => {
    if (a === 'latest') return -1
    if (b === 'latest') return 1
    return a.localeCompare(b)
  })
}

/**
 * Build a map from version strings to their associated dist-tags
 * Handles the case where multiple tags point to the same version
 * @param distTags - Object mapping tag names to version strings
 * @returns Map from version to sorted array of tags
 */
export function buildVersionToTagsMap(distTags: Record<string, string>): Map<string, string[]> {
  const map = new Map<string, string[]>()

  for (const [tag, version] of Object.entries(distTags)) {
    const existing = map.get(version)
    if (existing) {
      existing.push(tag)
    } else {
      map.set(version, [tag])
    }
  }

  // Sort tags within each version
  for (const tags of map.values()) {
    tags.sort((a, b) => {
      if (a === 'latest') return -1
      if (b === 'latest') return 1
      return a.localeCompare(b)
    })
  }

  return map
}

/** A tagged version row for display */
export interface TaggedVersionRow {
  /** Unique identifier for the row */
  id: string
  /** Primary tag (first in sorted order, used for expand/collapse) */
  primaryTag: string
  /** All tags for this version */
  tags: string[]
  /** The version string */
  version: string
}

/**
 * Build deduplicated rows for tagged versions
 * Each unique version appears once with all its tags
 * @param distTags - Object mapping tag names to version strings
 * @returns Array of rows sorted by version (descending)
 */
export function buildTaggedVersionRows(distTags: Record<string, string>): TaggedVersionRow[] {
  const versionToTags = buildVersionToTagsMap(distTags)

  return Array.from(versionToTags.entries())
    .map(([version, tags]) => ({
      id: `version:${version}`,
      primaryTag: tags[0]!,
      tags,
      version,
    }))
    .sort((a, b) => compare(b.version, a.version))
}

/**
 * Filter tags to exclude those already shown in a parent context
 * Useful when showing nested versions that shouldn't repeat parent tags
 * @param tags - Tags to filter
 * @param excludeTags - Tags to exclude
 * @returns Filtered array of tags
 */
export function filterExcludedTags(tags: string[], excludeTags: string[]): string[] {
  const excludeSet = new Set(excludeTags)
  return tags.filter(tag => !excludeSet.has(tag))
}

/**
 * Get a grouping key for a version that handles 0.x versions specially.
 *
 * Per semver spec, versions below 1.0.0 can have breaking changes in minor bumps,
 * so 0.9.x should be in a separate group from 0.10.x.
 *
 * @param version - The version string (e.g., "0.9.3", "1.2.3")
 * @returns A grouping key string (e.g., "0.9", "1")
 */
export function getVersionGroupKey(version: string): string {
  const parsed = parseVersion(version)
  if (parsed.major === 0) {
    // For 0.x versions, group by major.minor
    return `0.${parsed.minor}`
  }
  // For 1.x+, group by major only
  return String(parsed.major)
}

/**
 * Get a display label for a version group key.
 *
 * @param groupKey - The group key from getVersionGroupKey()
 * @returns A display label (e.g., "0.9.x", "1.x")
 */
export function getVersionGroupLabel(groupKey: string): string {
  return `${groupKey}.x`
}

/**
 * Check if two versions belong to the same version group.
 *
 * For versions >= 1.0.0, same major = same group.
 * For versions < 1.0.0, same major.minor = same group.
 *
 * @param versionA - First version string
 * @param versionB - Second version string
 * @returns true if both versions are in the same group
 */
export function isSameVersionGroup(versionA: string, versionB: string): boolean {
  return getVersionGroupKey(versionA) === getVersionGroupKey(versionB)
}
