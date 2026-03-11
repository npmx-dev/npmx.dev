import type { H3Event } from 'h3'

/**
 * Runtime payload cache for ISR-enabled routes.
 *
 * Mirrors Nuxt's pre-render `payloadCache` behavior at runtime:
 * - When an HTML page is rendered, the payload is cached (serialized by the
 *   Nuxt app plugin `payload-cache.server.ts` and stashed on event.context)
 * - When a `_payload.json` request arrives, the cache is checked first.
 *   If a cached payload exists, it's served immediately — completely skipping
 *   the full Vue SSR render.
 *
 * This eliminates redundant full SSR renders for payload requests when the
 * same route was already rendered as HTML (or as a payload) recently.
 */

const PAYLOAD_URL_RE = /^[^?]*\/_payload\.json(?:\?.*)?$/
const PAYLOAD_CACHE_STORAGE_KEY = 'payload-cache'

/** Default TTL for cached payloads (seconds). Matches ISR expiration for package routes. */
const PAYLOAD_CACHE_TTL = 60

/**
 * Grace period beyond TTL where stale payloads are still served (seconds).
 * Prevents a race where the HTML is served from Vercel's ISR cache right before
 * expiry, but the payload request arrives a moment later after our cache expires.
 */
const PAYLOAD_CACHE_STALE_TTL = PAYLOAD_CACHE_TTL * 2

interface CachedPayload {
  body: string
  statusCode: number
  headers: Record<string, string>
  cachedAt: number
  buildId: string
}

export default defineNitroPlugin(nitroApp => {
  const storage = useStorage(PAYLOAD_CACHE_STORAGE_KEY)
  const buildId = useRuntimeConfig().app.buildId as string

  /**
   * Get the route path from a _payload.json URL.
   * e.g. "/package/vue/v/3.4.0/_payload.json?abc123" → "/package/vue/v/3.4.0"
   */
  function getRouteFromPayloadUrl(url: string): string {
    const withoutQuery = url.replace(/\?.*$/, '')
    return withoutQuery.substring(0, withoutQuery.lastIndexOf('/')) || '/'
  }

  /**
   * Generate a cache key for a route path.
   * Includes the build ID to prevent serving stale payloads after deploys.
   */
  function getCacheKey(routePath: string): string {
    return `${buildId}:${routePath}`
  }

  /**
   * Check if a route has ISR or cache rules enabled.
   */
  function isISRRoute(event: H3Event): boolean {
    const rules = getRouteRules(event)
    return !!(rules.isr || rules.cache)
  }

  // -------------------------------------------------------------------------
  // render:before — Serve cached payloads, skip full SSR render
  // -------------------------------------------------------------------------
  nitroApp.hooks.hook('render:before', async ctx => {
    // Only intercept _payload.json requests
    if (!PAYLOAD_URL_RE.test(ctx.event.path)) return

    const routePath = getRouteFromPayloadUrl(ctx.event.path)
    const cacheKey = getCacheKey(routePath)

    try {
      const cached = await storage.getItem<CachedPayload>(cacheKey)
      if (!cached) return

      // Verify build ID matches (extra safety beyond cache key)
      if (cached.buildId !== buildId) return

      // Check TTL — serve stale payloads within the grace period to avoid
      // a race where HTML is cached by Vercel but our payload has expired
      const age = (Date.now() - cached.cachedAt) / 1000
      if (age > PAYLOAD_CACHE_STALE_TTL) return

      if (import.meta.dev) {
        // eslint-disable-next-line no-console
        console.log(`[payload-cache] HIT: ${routePath} (age: ${age.toFixed(1)}s)`)
      }

      // Set the response — this completely skips the Nuxt render function
      ctx.response = {
        body: cached.body,
        statusCode: cached.statusCode,
        statusMessage: 'OK',
        headers: cached.headers,
      }
    } catch (error) {
      // Cache read failed — let the render proceed normally
      if (import.meta.dev) {
        // eslint-disable-next-line no-console
        console.warn(`[payload-cache] Cache read failed for ${routePath}:`, error)
      }
    }
  })

  // -------------------------------------------------------------------------
  // render:response — Cache payloads after rendering
  // -------------------------------------------------------------------------
  nitroApp.hooks.hook('render:response', (response, ctx) => {
    // Don't cache error or unknown responses
    if (!response.statusCode || response.statusCode >= 400) return

    const isPayloadRequest = PAYLOAD_URL_RE.test(ctx.event.path)
    const isHtmlResponse = response.headers?.['content-type']?.includes('text/html')

    if (isPayloadRequest) {
      // This was a _payload.json render — cache the response body directly
      if (typeof response.body !== 'string') return
      const routePath = getRouteFromPayloadUrl(ctx.event.path)
      cachePayload(ctx.event, routePath, {
        body: response.body,
        statusCode: response.statusCode ?? 200,
        headers: {
          'content-type': 'application/json;charset=utf-8',
          'x-powered-by': 'Nuxt',
        },
      })
    } else if (isHtmlResponse && isISRRoute(ctx.event)) {
      // This was an HTML render for an ISR route — check if the Nuxt plugin
      // stashed a serialized payload on the event context
      const cachedPayload = ctx.event.context._cachedPayloadResponse
      if (cachedPayload) {
        const pathWithoutQuery = ctx.event.path.replace(/\?.*$/, '')
        const routePath = pathWithoutQuery === '/' ? '/' : pathWithoutQuery.replace(/\/$/, '')
        cachePayload(ctx.event, routePath, cachedPayload)
        // Clean up the stashed payload
        delete ctx.event.context._cachedPayloadResponse
      }
    }
  })

  /**
   * Write a payload to the cache in the background (non-blocking).
   */
  function cachePayload(
    event: H3Event,
    routePath: string,
    payload: { body: string; statusCode: number; headers: Record<string, string> },
  ) {
    const cacheKey = getCacheKey(routePath)
    const entry: CachedPayload = {
      ...payload,
      cachedAt: Date.now(),
      buildId,
    }

    // Use waitUntil for non-blocking cache writes in serverless environments
    event.waitUntil(
      storage.setItem(cacheKey, entry).catch(error => {
        if (import.meta.dev) {
          // eslint-disable-next-line no-console
          console.warn(`[payload-cache] Cache write failed for ${routePath}:`, error)
        }
      }),
    )

    if (import.meta.dev) {
      // eslint-disable-next-line no-console
      console.log(`[payload-cache] CACHED: ${routePath}`)
    }
  }
})

// Extend the H3EventContext type
declare module 'h3' {
  interface H3EventContext {
    _cachedPayloadResponse?: {
      body: string
      statusCode: number
      headers: Record<string, string>
    }
  }
}
