import type { LocationQueryValue } from 'vue-router'
import { withoutProtocol, withoutTrailingSlash } from 'ufo'

/**
 * Normalize a URL for comparison by removing protocol, www prefix,
 * trailing slashes, hash fragments, and common git tree paths.
 *
 * Uses ufo utilities where possible, with additional handling for
 * www prefix and git-specific paths that ufo's isEqual doesn't cover.
 */
export function normalizeUrlForComparison(url: string): string {
  let normalized = withoutProtocol(url).toLowerCase()
  normalized = withoutTrailingSlash(normalized)
  normalized = normalized
    .replace(/^www\./, '')
    .replace(/#.*$/, '')
    .replace(/\/tree\/(head|main|master)(\/|$)/i, '/')
  return withoutTrailingSlash(normalized)
}

/**
 * Check if two URLs point to the same resource.
 * Handles differences in protocol (http/https), www prefix,
 * trailing slashes, and common git branch paths.
 */
export function areUrlsEquivalent(url1: string, url2: string): boolean {
  return normalizeUrlForComparison(url1) === normalizeUrlForComparison(url2)
}

export function normalizeSearchParam(query?: LocationQueryValue | LocationQueryValue[]): string {
  if (!query) return ''

  if (typeof query === 'string') return query

  return normalizeSearchParam(query[0])
}
