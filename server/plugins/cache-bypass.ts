import { BYPASS_CACHE_QUERY_PARAM } from '#shared/utils/cache-bypass'

/**
 * Server plugin that initializes cache bypass context from query parameters.
 * This runs early in the request lifecycle so all other caching layers can check
 * whether to bypass based on the `__debug_cache__` query parameter.
 *
 * Also attempts to clear Nitro cache entries when bypass is requested.
 */
export default defineNitroPlugin(nitroApp => {
  nitroApp.hooks.hook('request', async event => {
    // Check for bypass param early
    const url = getRequestURL(event)
    const bypassParam = url.searchParams.get(BYPASS_CACHE_QUERY_PARAM)

    if (bypassParam) {
      // Clear Nitro caches (handlers, functions)
      // Storage base is 'cache' which maps to .nuxt/cache/nitro/
      const cacheStorage = useStorage('cache')
      const normalizedParam = bypassParam.toLowerCase()
      const clearAll =
        normalizedParam === '1' || normalizedParam === 'all' || normalizedParam === 'true'

      try {
        const keys = await cacheStorage.getKeys()

        let matchingKeys: string[]

        if (clearAll) {
          // Clear everything
          matchingKeys = keys
          if (import.meta.dev) {
            // eslint-disable-next-line no-console
            console.log(`[cache-bypass] Clearing ALL ${keys.length} cache entries`)
          }
        } else {
          // Extract path segment for matching (e.g., "vue-use" from "/vue-use")
          const pathSegment = url.pathname.replace(/^\//, '').replace(/\//g, '')

          if (import.meta.dev && keys.length > 0) {
            // eslint-disable-next-line no-console
            console.log(
              `[cache-bypass] Found ${keys.length} cache keys, looking for: ${pathSegment}`,
            )
          }

          matchingKeys = keys.filter(key => {
            const keyLower = key.toLowerCase()
            const segmentLower = pathSegment.toLowerCase()
            return keyLower.includes(segmentLower)
          })
        }

        for (const key of matchingKeys) {
          await cacheStorage.removeItem(key)
          if (import.meta.dev) {
            // eslint-disable-next-line no-console
            console.log(`[cache-bypass] Cleared cache: ${key}`)
          }
        }
      } catch (error) {
        if (import.meta.dev) {
          // eslint-disable-next-line no-console
          console.warn(`[cache-bypass] Failed to clear cache:`, error)
        }
      }
    }

    // Initialize bypass context for other layers
    initCacheBypassContext(event)
  })

  // After response is ready, disable caching if bypass was requested
  nitroApp.hooks.hook('beforeResponse', event => {
    if (event.context.cacheBypass) {
      // Disable any response caching (ISR, CDN, browser)
      setHeader(event, 'Cache-Control', 'private, no-cache, no-store, must-revalidate')
      setHeader(event, 'CDN-Cache-Control', 'no-store')
      setHeader(event, 'Vercel-CDN-Cache-Control', 'no-store')
    }
  })
})
