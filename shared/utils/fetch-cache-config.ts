/**
 * Configuration for the stale-while-revalidate fetch cache.
 *
 * This cache intercepts external API calls during SSR and caches responses
 * using Nitro's storage layer (backed by Vercel's runtime cache in production).
 */

import { CONSTELLATION_HOST, SLINGSHOT_HOST } from './constants'

/**
 * Domains that should have their fetch responses cached.
 * Only requests to these domains will be intercepted and cached.
 */
export const FETCH_CACHE_ALLOWED_DOMAINS = [
  // npm registry
  'registry.npmjs.org', // npm package metadata (packuments)
  'api.npmjs.org', // npm download statistics

  // JSR registry
  'jsr.io', // JSR package metadata

  // Git hosting providers (for repo metadata)
  'ungh.cc', // GitHub proxy (avoids rate limits)
  'api.github.com', // GitHub API
  'gitlab.com', // GitLab API
  'api.bitbucket.org', // Bitbucket API
  'codeberg.org', // Codeberg (Gitea-based)
  'gitee.com', // Gitee API
  // microcosm endpoints for atproto data
  CONSTELLATION_HOST,
  SLINGSHOT_HOST,
] as const

/**
 * Default TTL for cached fetch responses (in seconds).
 * After this time, cached data is considered "stale" but will still be
 * returned immediately while a background revalidation occurs.
 */
export const FETCH_CACHE_DEFAULT_TTL = 60 * 5 // 5 minutes

/**
 * Cache key version prefix.
 * Increment this to invalidate all cached entries (e.g., after format changes).
 */
export const FETCH_CACHE_VERSION = 'v1'

/**
 * Storage key prefix for fetch cache entries.
 */
export const FETCH_CACHE_STORAGE_BASE = 'fetch-cache'

/**
 * Check if a URL's host is in the allowed domains list.
 */
export function isAllowedDomain(url: string | URL): boolean {
  try {
    const urlObj = typeof url === 'string' ? new URL(url) : url
    return FETCH_CACHE_ALLOWED_DOMAINS.some(domain => urlObj.host === domain)
  } catch {
    return false
  }
}

/**
 * Structure of a cached fetch entry stored in Nitro storage.
 */
export interface CachedFetchEntry<T = unknown> {
  /** The response body/data */
  data: T
  /** HTTP status code */
  status: number
  /** Response headers (subset) */
  headers: Record<string, string>
  /** Unix timestamp when the entry was cached */
  cachedAt: number
  /** TTL in seconds */
  ttl: number
}

/**
 * Check if a cached entry is stale (past its TTL).
 */
export function isCacheEntryStale(entry: CachedFetchEntry): boolean {
  const now = Date.now()
  const expiresAt = entry.cachedAt + entry.ttl * 1000
  return now > expiresAt
}

/**
 * Result returned by cachedFetch with staleness metadata.
 * This allows consumers to know if the data came from stale cache
 * and potentially trigger client-side revalidation.
 */
export interface CachedFetchResult<T> {
  /** The response data */
  data: T
  /** Whether the data came from stale cache (past TTL) */
  isStale: boolean
  /** Unix timestamp when the data was cached, or null if fresh fetch */
  cachedAt: number | null
}

/**
 * Type for the cachedFetch function attached to event context.
 */
export type CachedFetchFunction = <T = unknown>(
  url: string,
  options?: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  },
  ttl?: number,
) => Promise<CachedFetchResult<T>>
