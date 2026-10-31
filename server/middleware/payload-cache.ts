import { defineEventHandler } from 'nuxt/server'
import type { CachedPayload } from '#server/utils/payload-cache'
import {
  PAYLOAD_CACHE_STALE_TTL,
  PAYLOAD_URL_RE,
  getPayloadCache,
  getPayloadCacheBuildId,
  getRouteFromPayloadUrl,
} from '#server/utils/payload-cache'

/**
 * Serve `_payload.json` responses from the runtime payload cache, skipping SSR.
 */
export default defineEventHandler(async event => {
  const pathname = event.url.pathname
  if (!PAYLOAD_URL_RE.test(pathname)) return

  const buildId = getPayloadCacheBuildId()
  const { storage, getCacheKey } = getPayloadCache(buildId)
  const routePath = getRouteFromPayloadUrl(pathname)

  try {
    const cached = await storage.getItem<CachedPayload>(getCacheKey(routePath))
    if (!cached || cached.buildId !== buildId) return

    const age = (Date.now() - cached.cachedAt) / 1000
    if (age > PAYLOAD_CACHE_STALE_TTL) return

    if (import.meta.dev) {
      // eslint-disable-next-line no-console
      console.log(`[payload-cache] HIT: ${routePath} (age: ${age.toFixed(1)}s)`)
    }

    return new Response(cached.body, {
      status: cached.statusCode,
      headers: cached.headers,
    })
  } catch (error) {
    // Cache read failed — let the render proceed normally
    if (import.meta.dev) {
      // eslint-disable-next-line no-console
      console.warn(`[payload-cache] Cache read failed for ${routePath}:`, error)
    }
  }
})
