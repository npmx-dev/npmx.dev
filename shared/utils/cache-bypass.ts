/**
 * Cache bypass configuration.
 *
 * Use the query parameter `__bypass_cache__` to bypass caching layers:
 * - `?__bypass_cache__=1` or `?__bypass_cache__=all` - Bypass all caching layers
 * - `?__bypass_cache__=fetch` - Bypass only the custom fetch cache (external API calls)
 * - `?__bypass_cache__=handler` - Bypass all API route handlers
 * - `?__bypass_cache__=readme` - Bypass only the readme handler (specific key)
 *
 * Multiple layers can be specified with commas: `?__bypass_cache__=fetch,readme`
 *
 * Note: ISR/edge caching via Vercel cannot be bypassed with this mechanism as it
 * happens at the CDN level before the request reaches our code.
 */

export const BYPASS_CACHE_QUERY_PARAM = '__bypass_cache__'
export const BYPASS_CACHE_HEADER = 'X-Cache-Bypass'

/**
 * Cache categories that bypass all caches of that type.
 */
export type CacheCategory = 'fetch' | 'handler'

export const ALL_CACHE_CATEGORIES: readonly CacheCategory[] = ['fetch', 'handler'] as const

/**
 * Parsed bypass configuration containing both categories and specific keys.
 */
export interface CacheBypassConfig {
  /** Category-level bypasses (e.g., 'fetch', 'handler') */
  categories: Set<CacheCategory>
  /** Specific cache keys to bypass (e.g., 'readme', 'npm-package') */
  keys: Set<string>
  /** Whether to bypass all caching */
  all: boolean
}

/**
 * Parse the bypass cache query parameter value into a bypass configuration.
 */
export function parseBypassCacheParam(value: string | undefined | null): CacheBypassConfig {
  const config: CacheBypassConfig = {
    categories: new Set(),
    keys: new Set(),
    all: false,
  }

  if (!value) {
    return config
  }

  const normalizedValue = value.toLowerCase().trim()

  // Handle "all" or "1" as bypass everything
  if (normalizedValue === 'all' || normalizedValue === '1' || normalizedValue === 'true') {
    config.all = true
    return config
  }

  // Parse comma-separated list
  for (const part of normalizedValue.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue

    if (ALL_CACHE_CATEGORIES.includes(trimmed as CacheCategory)) {
      config.categories.add(trimmed as CacheCategory)
    } else {
      config.keys.add(trimmed)
    }
  }

  return config
}

/**
 * Check if a specific cache should be bypassed.
 * @param config - The parsed bypass configuration
 * @param category - The cache category (e.g., 'handler')
 * @param key - The specific cache key (e.g., 'readme')
 */
export function shouldBypassCache(
  config: CacheBypassConfig | undefined,
  category: CacheCategory,
  key?: string,
): boolean {
  if (!config) return false
  if (config.all) return true
  if (config.categories.has(category)) return true
  if (key && config.keys.has(key)) return true
  return false
}

/**
 * Get a display string for the bypass config (for headers/logging).
 */
export function bypassConfigToString(config: CacheBypassConfig): string {
  if (config.all) return 'all'
  const parts = [...config.categories, ...config.keys]
  return parts.join(',')
}
