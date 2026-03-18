import type { CachedFetchResult } from '#shared/utils/fetch-cache-config'
import { defu } from 'defu'

/**
 * Get the cachedFetch function from the current request context.
 *
 * IMPORTANT: This must be called in the composable setup context (outside of
 * useAsyncData handlers). The returned function can then be used inside handlers.
 *
 * The returned function returns a wrapper object with staleness metadata:
 * - `data`: The response data
 * - `isStale`: Whether the data came from stale cache
 * - `cachedAt`: Unix timestamp when cached, or null if fresh fetch
 *
 * @example
 * ```ts
 * export function usePackage(name: MaybeRefOrGetter<string>) {
 *   // Get cachedFetch in setup context
 *   const cachedFetch = useCachedFetch()
 *
 *   return useLazyAsyncData(
 *     () => `package:${toValue(name)}`,
 *     // Use it inside the handler - destructure { data } or { data, isStale }
 *     async () => {
 *       const { data } = await cachedFetch<Packument>(`https://registry.npmjs.org/${toValue(name)}`)
 *       return data
 *     }
 *   )
 * }
 * ```
 */
export function useCachedFetch(): CachedFetchFunction {
  // On client, return a function that just uses $fetch (no caching, not stale)
  if (import.meta.client) {
    return async <T = unknown>(
      url: string,
      options: Parameters<typeof $fetch>[1] = {},
      _ttl: number = FETCH_CACHE_DEFAULT_TTL,
    ): Promise<CachedFetchResult<T>> => {
      const defaultFetchOptions: Parameters<typeof $fetch>[1] = {
        cache: 'force-cache',
      }
      const data = (await $fetch<T>(url, defu(options, defaultFetchOptions))) as T
      return { data, isStale: false, cachedAt: null }
    }
  }

  // On server, get the cachedFetch from request context
  const event = useRequestEvent()
  const serverCachedFetch = event?.context?.cachedFetch

  // If cachedFetch is available from middleware, return it
  if (serverCachedFetch) {
    return serverCachedFetch as CachedFetchFunction
  }

  // Fallback: return a function that uses regular $fetch
  // (shouldn't happen in normal operation)
  return async <T = unknown>(
    url: string,
    options: Parameters<typeof $fetch>[1] = {},
    _ttl: number = FETCH_CACHE_DEFAULT_TTL,
  ): Promise<CachedFetchResult<T>> => {
    const defaultFetchOptions: Parameters<typeof $fetch>[1] = {
      cache: 'force-cache',
    }
    const data = (await $fetch<T>(url, defu(options, defaultFetchOptions))) as T
    return { data, isStale: false, cachedAt: null }
  }
}
