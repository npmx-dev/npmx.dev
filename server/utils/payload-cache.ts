import type { H3Event } from 'nitro/h3'
import { useKV } from 'nitro/kv'
import { getRouteRules, useRuntimeConfig } from 'nuxt/server'

export const PAYLOAD_URL_RE = /^[^?]*\/_payload\.json(?:\?.*)?$/
const PAYLOAD_CACHE_STORAGE_KEY = 'payload-cache'

/** Default TTL for cached payloads (seconds). Matches ISR expiration for package routes. */
const PAYLOAD_CACHE_TTL = 60

/**
 * Grace period beyond TTL where stale payloads are still served (seconds).
 * Prevents a race where the HTML is served from Vercel's ISR cache right before
 * expiry, but the payload request arrives a moment later after our cache expires.
 */
export const PAYLOAD_CACHE_STALE_TTL = PAYLOAD_CACHE_TTL * 2

export interface CachedPayload {
  body: string
  statusCode: number
  headers: Record<string, string>
  cachedAt: number
  buildId: string
}

/**
 * Get the route path from a _payload.json URL.
 * e.g. "/package/vue/v/3.4.0/_payload.json?abc123" → "/package/vue/v/3.4.0"
 */
export function getRouteFromPayloadUrl(url: string): string {
  const withoutQuery = url.replace(/\?.*$/, '')
  return withoutQuery.substring(0, withoutQuery.lastIndexOf('/')) || '/'
}

/** Check if a route has ISR or cache rules enabled. */
export function isISRRoute(event: H3Event): boolean {
  const rules = getRouteRules(event)
  return !!(rules.isr || rules.cache)
}

export function getPayloadCache(buildId: string) {
  return {
    storage: useKV(PAYLOAD_CACHE_STORAGE_KEY),
    getCacheKey: (routePath: string) => `${buildId}:${routePath}`,
  }
}

export function getPayloadCacheBuildId(): string {
  return useRuntimeConfig().app.buildId as string
}
