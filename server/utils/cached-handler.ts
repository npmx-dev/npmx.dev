import type { CachedEventHandlerOptions, EventHandler } from 'nitropack/types'
import type { H3Event } from 'h3'
import { shouldBypassCacheFor } from './cache-bypass'

/**
 * Extended options that include a bypass key for fine-grained cache control.
 */
interface BypassableCachedEventHandlerOptions<
  Response,
> extends CachedEventHandlerOptions<Response> {
  /**
   * Unique key for this handler's cache bypass.
   * When `?__debug_cache__=<key>` is present, only this handler's cache is bypassed.
   * When `?__debug_cache__=handler` is present, all handlers are bypassed.
   */
  bypassKey?: string
}

/**
 * Wrapper around `defineCachedEventHandler` that automatically respects the
 * `__debug_cache__` query parameter for cache bypass.
 *
 * Supports both category-level and specific key bypass:
 * - `?__debug_cache__=handler` - Bypass all handlers
 * - `?__debug_cache__=readme` - Bypass only handlers with bypassKey='readme'
 */
export function defineBypassableCachedEventHandler<Request extends EventHandler, Response>(
  handler: Request,
  options: BypassableCachedEventHandlerOptions<Response> = {},
) {
  const { bypassKey, ...cachedOptions } = options
  const originalShouldBypassCache = cachedOptions.shouldBypassCache

  return defineCachedEventHandler(handler, {
    ...cachedOptions,
    shouldBypassCache: (event: H3Event) => {
      // Check debug cache bypass (category or specific key)
      if (shouldBypassCacheFor(event, 'handler', bypassKey)) {
        if (import.meta.dev) {
          // eslint-disable-next-line no-console
          console.log(`[cached-handler] BYPASS (${bypassKey || 'handler'}): ${event.path}`)
        }
        return true
      }

      // Fall back to original shouldBypassCache if provided
      if (originalShouldBypassCache) {
        return originalShouldBypassCache(event)
      }

      return false
    },
  })
}
