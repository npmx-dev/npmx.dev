import type { H3Event } from 'nitro/h3'
import { definePlugin } from 'nitro'
import type { CachedPayload } from '#server/utils/payload-cache'
import {
  PAYLOAD_URL_RE,
  getPayloadCache,
  getPayloadCacheBuildId,
  getRouteFromPayloadUrl,
  isISRRoute,
} from '#server/utils/payload-cache'

/**
 * Runtime payload cache for ISR-enabled routes.
 *
 * Mirrors Nuxt's pre-render `payloadCache` behavior at runtime:
 * - When an HTML page is rendered, the payload is cached (serialized by the
 *   Nuxt app plugin `payload-cache.server.ts` and stashed on event.context)
 * - When a `_payload.json` request arrives, the middleware serves the cache
 *   first, completely skipping the full Vue SSR render.
 */
export default definePlugin(nitroApp => {
  const buildId = getPayloadCacheBuildId()
  const { storage, getCacheKey } = getPayloadCache(buildId)

  // -------------------------------------------------------------------------
  // response — Cache payloads after rendering
  // -------------------------------------------------------------------------
  nitroApp.hooks.hook('response', async (response, rawEvent) => {
    const event = rawEvent as H3Event
    const pathname = event.url.pathname
    const isPayloadRequest = PAYLOAD_URL_RE.test(pathname)
    const isHtmlResponse = response.headers.get('content-type')?.includes('text/html')

    if (isPayloadRequest) {
      if (response.status >= 400) return
      const body = await response.clone().text()
      const routePath = getRouteFromPayloadUrl(pathname)
      cachePayload(event, routePath, {
        body,
        statusCode: response.status,
        headers: {
          'content-type': 'application/json;charset=utf-8',
          'x-powered-by': 'Nuxt',
        },
      })
    } else if (isHtmlResponse && isISRRoute(event)) {
      // Check if the Nuxt app plugin stashed a serialized payload on the event context
      // oxlint-disable-next-line eslint/no-underscore-dangle
      const cachedPayload = event.context._cachedPayloadResponse
      if (cachedPayload) {
        const pathWithoutQuery = pathname.replace(/\?.*$/, '')
        const routePath = pathWithoutQuery === '/' ? '/' : pathWithoutQuery.replace(/\/$/, '')
        cachePayload(event, routePath, cachedPayload)
        // Clean up the stashed payload
        // oxlint-disable-next-line eslint/no-underscore-dangle
        delete event.context._cachedPayloadResponse
      }
    }
  })

  /** Write a payload to the cache in the background (non-blocking). */
  function cachePayload(
    event: H3Event,
    routePath: string,
    payload: { body: string; statusCode: number; headers: Record<string, string> },
  ) {
    const entry: CachedPayload = {
      ...payload,
      cachedAt: Date.now(),
      buildId,
    }

    event.waitUntil(
      storage.setItem(getCacheKey(routePath), entry).catch(error => {
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

declare module 'nuxt/schema' {
  interface RequestEventContext {
    _cachedPayloadResponse?: {
      body: string
      statusCode: number
      headers: Record<string, string>
    }
  }
}
