import type { H3Event } from 'h3'
import {
  type CacheBypassConfig,
  type CacheCategory,
  BYPASS_CACHE_QUERY_PARAM,
  BYPASS_CACHE_HEADER,
  parseBypassCacheParam,
  shouldBypassCache,
  bypassConfigToString,
} from '#shared/utils/cache-bypass'

/**
 * Get the cache bypass configuration from the event context.
 * This is set by the cache-bypass plugin early in the request lifecycle.
 */
export function getBypassConfig(event: H3Event): CacheBypassConfig | undefined {
  return event.context.cacheBypass as CacheBypassConfig | undefined
}

/**
 * Check if a specific cache should be bypassed for this request.
 * @param event - The H3 event
 * @param category - The cache category (e.g., 'handler', 'fetch')
 * @param key - Optional specific cache key (e.g., 'readme', 'npm-package')
 */
export function shouldBypassCacheFor(
  event: H3Event,
  category: CacheCategory,
  key?: string,
): boolean {
  return shouldBypassCache(getBypassConfig(event), category, key)
}

/**
 * Initialize the cache bypass context from query parameters.
 * Called by the cache-bypass plugin.
 */
export function initCacheBypassContext(event: H3Event): void {
  const query = getQuery(event)
  const bypassParam = query[BYPASS_CACHE_QUERY_PARAM]
  const paramValue = Array.isArray(bypassParam) ? bypassParam[0] : bypassParam

  if (paramValue) {
    const config = parseBypassCacheParam(String(paramValue))
    const hasConfig = config.all || config.categories.size > 0 || config.keys.size > 0

    if (hasConfig) {
      event.context.cacheBypass = config

      // Set response header indicating which caches are being bypassed
      setHeader(event, BYPASS_CACHE_HEADER, bypassConfigToString(config))

      if (import.meta.dev) {
        // eslint-disable-next-line no-console
        console.log(`[cache-bypass] Bypassing: ${bypassConfigToString(config)}`)
      }
    }
  }
}

// Extend the H3EventContext type
declare module 'h3' {
  interface H3EventContext {
    cacheBypass?: CacheBypassConfig
  }
}
