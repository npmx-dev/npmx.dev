import type { CachedFunctionOptions } from 'nitropack/types'
import { shouldBypassCacheFor } from './cache-bypass'

/**
 * Extended options that include a bypass key for fine-grained cache control.
 */
interface BypassableCachedFunctionOptions<T, ArgsT extends unknown[]> extends CachedFunctionOptions<
  T,
  ArgsT
> {
  /**
   * Unique key for this function's cache bypass.
   * When `?__debug_cache__=<bypassKey>` is present, only this function's cache is bypassed.
   * When `?__debug_cache__=handler` is present, all cached functions are bypassed
   * (they fall under the 'handler' category since they're called from handlers).
   */
  bypassKey?: string
}

/**
 * Wrapper around `defineCachedFunction` that automatically respects the
 * `__debug_cache__` query parameter for cache bypass.
 *
 * Supports both category-level and specific key bypass:
 * - `?__debug_cache__=handler` - Bypass all (handlers include their cached functions)
 * - `?__debug_cache__=npm-package` - Bypass only functions with bypassKey='npm-package'
 *
 * Note: This uses H3's `useEvent()` to access the request context, which
 * requires the function to be called within a request handler context.
 */
export function defineBypassableCachedFunction<T, ArgsT extends unknown[] = []>(
  func: (...args: ArgsT) => T | Promise<T>,
  options: BypassableCachedFunctionOptions<T, ArgsT> = {},
) {
  const { bypassKey, ...cachedOptions } = options
  const originalShouldBypassCache = cachedOptions.shouldBypassCache

  return defineCachedFunction(func, {
    ...cachedOptions,
    shouldBypassCache: (...args: ArgsT) => {
      // Try to get the current event from async context
      // This may return null if called outside a request context
      try {
        const event = useEvent()
        // Check using 'handler' category since cached functions are called from handlers
        if (event && shouldBypassCacheFor(event, 'handler', bypassKey)) {
          if (import.meta.dev) {
            // eslint-disable-next-line no-console
            console.log(
              `[cached-function] BYPASS (${bypassKey || 'handler'}): ${cachedOptions.name || 'anonymous'}`,
            )
          }
          return true
        }
      } catch {
        // useEvent() throws if called outside request context
        // In that case, don't bypass
      }

      // Fall back to original shouldBypassCache if provided
      if (originalShouldBypassCache) {
        return originalShouldBypassCache(...args)
      }

      return false
    },
  })
}
