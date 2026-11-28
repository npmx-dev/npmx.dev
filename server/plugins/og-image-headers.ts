import type { H3Event } from 'h3'
import { getResponseHeader, getResponseStatus, removeResponseHeader, setResponseHeader } from 'h3'
import { parseURL } from 'ufo'

export const DYNAMIC_OG_CACHE_CONTROL =
  'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400'

export function normalizeOgImageResponseHeaders(event: H3Event): void {
  const pathname = parseURL(event.path).pathname
  if (!pathname.startsWith('/_og/d/')) return
  if (getResponseStatus(event) !== 200) return

  const contentType = getResponseHeader(event, 'content-type')
  if (typeof contentType !== 'string' || !contentType.startsWith('image/')) return

  // Image responses are already compressed. Vary: accept-encoding, host
  // fragments CDN cache entries across crawlers with different Accept-Encoding headers.
  removeResponseHeader(event, 'vary')
  setResponseHeader(event, 'cache-control', DYNAMIC_OG_CACHE_CONTROL)
}

export default defineNitroPlugin(nitroApp => {
  if (import.meta.dev || import.meta.prerender) return

  nitroApp.hooks.hook('beforeResponse', event => {
    normalizeOgImageResponseHeaders(event)
  })
})
