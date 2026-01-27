import type { CachedFetchEntry } from '#shared/utils/fetch-cache-config'
import {
  FETCH_CACHE_DEFAULT_TTL,
  FETCH_CACHE_STORAGE_BASE,
  FETCH_CACHE_VERSION,
  isAllowedDomain,
  isCacheEntryStale,
} from '#shared/utils/fetch-cache-config'

/**
 * Simple hash function for cache keys.
 */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

/**
 * Generate a cache key for a fetch request.
 */
function generateFetchCacheKey(url: string | URL, method: string = 'GET', body?: unknown): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url
  const bodyHash = body ? simpleHash(JSON.stringify(body)) : ''
  const searchHash = urlObj.search ? simpleHash(urlObj.search) : ''

  const parts = [
    FETCH_CACHE_VERSION,
    urlObj.host,
    method.toUpperCase(),
    urlObj.pathname,
    searchHash,
    bodyHash,
  ].filter(Boolean)

  return parts.join(':')
}

export type CachedFetchFunction = <T = unknown>(
  url: string,
  options?: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  },
  ttl?: number,
) => Promise<T>

/**
 * Server middleware that attaches a cachedFetch function to the event context.
 * This allows app composables to access the cached fetch via useRequestEvent().
 */
export default defineNitroPlugin(nitroApp => {
  const storage = useStorage(FETCH_CACHE_STORAGE_BASE)

  /**
   * Perform a cached fetch with stale-while-revalidate semantics.
   */
  const cachedFetch: CachedFetchFunction = async <T = unknown>(
    url: string,
    options: {
      method?: string
      body?: unknown
      headers?: Record<string, string>
    } = {},
    ttl: number = FETCH_CACHE_DEFAULT_TTL,
  ): Promise<T> => {
    // Check if this URL should be cached
    if (!isAllowedDomain(url)) {
      return (await $fetch(url, options as Parameters<typeof $fetch>[1])) as T
    }

    const method = options.method || 'GET'
    const cacheKey = generateFetchCacheKey(url, method, options.body)

    // Try to get cached response (with error handling for storage failures)
    let cached: CachedFetchEntry<T> | null = null
    try {
      cached = await storage.getItem<CachedFetchEntry<T>>(cacheKey)
    } catch (error) {
      // Storage read failed (e.g., ENOENT on misconfigured storage)
      // Log and continue without cache
      if (import.meta.dev) {
        console.warn(`[fetch-cache] Storage read failed for ${url}:`, error)
      }
    }

    if (cached) {
      if (!isCacheEntryStale(cached)) {
        // Cache hit, data is fresh
        if (import.meta.dev) {
          console.log(`[fetch-cache] HIT (fresh): ${url}`)
        }
        return cached.data
      }

      // Cache hit but stale - return stale data and revalidate in background
      if (import.meta.dev) {
        console.log(`[fetch-cache] HIT (stale, revalidating): ${url}`)
      }

      // Fire-and-forget background revalidation
      Promise.resolve().then(async () => {
        try {
          const freshData = (await $fetch(url, options as Parameters<typeof $fetch>[1])) as T
          const entry: CachedFetchEntry<T> = {
            data: freshData,
            status: 200,
            headers: {},
            cachedAt: Date.now(),
            ttl,
          }
          await storage.setItem(cacheKey, entry)
          if (import.meta.dev) {
            console.log(`[fetch-cache] Revalidated: ${url}`)
          }
        } catch (error) {
          if (import.meta.dev) {
            console.warn(`[fetch-cache] Revalidation failed: ${url}`, error)
          }
        }
      })

      // Return stale data immediately
      return cached.data
    }

    // Cache miss - fetch and cache
    if (import.meta.dev) {
      console.log(`[fetch-cache] MISS: ${url}`)
    }

    const data = (await $fetch(url, options as Parameters<typeof $fetch>[1])) as T

    // Try to cache the response (non-blocking, with error handling)
    try {
      const entry: CachedFetchEntry<T> = {
        data,
        status: 200,
        headers: {},
        cachedAt: Date.now(),
        ttl,
      }
      await storage.setItem(cacheKey, entry)
    } catch (error) {
      // Storage write failed - log but don't fail the request
      if (import.meta.dev) {
        console.warn(`[fetch-cache] Storage write failed for ${url}:`, error)
      }
    }

    return data
  }

  // Attach to event context for access in composables via useRequestEvent()
  nitroApp.hooks.hook('request', event => {
    event.context.cachedFetch = cachedFetch
  })
})

// Extend the H3EventContext type
declare module 'h3' {
  interface H3EventContext {
    cachedFetch?: CachedFetchFunction
  }
}
