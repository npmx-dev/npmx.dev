import type { H3Event } from 'h3'

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
) => Promise<T>

/**
 * Get the cachedFetch function from the current request context.
 *
 * IMPORTANT: This must be called in the composable setup context (outside of
 * useAsyncData handlers). The returned function can then be used inside handlers.
 *
 * @example
 * ```ts
 * export function usePackage(name: MaybeRefOrGetter<string>) {
 *   // Get cachedFetch in setup context
 *   const cachedFetch = useCachedFetch()
 *
 *   return useLazyAsyncData(
 *     () => `package:${toValue(name)}`,
 *     // Use it inside the handler
 *     () => cachedFetch<Packument>(`https://registry.npmjs.org/${toValue(name)}`)
 *   )
 * }
 * ```
 */
export function useCachedFetch(): CachedFetchFunction {
  // On client, return a function that just uses $fetch
  if (import.meta.client) {
    return async <T = unknown>(
      url: string,
      options: {
        method?: string
        body?: unknown
        headers?: Record<string, string>
      } = {},
      _ttl?: number,
    ): Promise<T> => {
      return (await $fetch(url, options as Parameters<typeof $fetch>[1])) as T
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
    options: {
      method?: string
      body?: unknown
      headers?: Record<string, string>
    } = {},
    _ttl?: number,
  ): Promise<T> => {
    return (await $fetch(url, options as Parameters<typeof $fetch>[1])) as T
  }
}

/**
 * Create a cachedFetch function from an H3Event.
 * Useful when you have direct access to the event.
 */
export function getCachedFetchFromEvent(event: H3Event | undefined): CachedFetchFunction {
  const serverCachedFetch = event?.context?.cachedFetch

  if (serverCachedFetch) {
    return serverCachedFetch as CachedFetchFunction
  }

  // Fallback to regular $fetch
  return async <T = unknown>(
    url: string,
    options: {
      method?: string
      body?: unknown
      headers?: Record<string, string>
    } = {},
    _ttl?: number,
  ): Promise<T> => {
    return (await $fetch(url, options as Parameters<typeof $fetch>[1])) as T
  }
}
