import type { H3Error, H3Event } from 'h3'
import { removeResponseHeader, send, setResponseHeader, setResponseStatus } from 'h3'
import { parseURL } from 'ufo'

export const OG_INVALID_CACHE_CONTROL = 'public, max-age=3600, s-maxage=3600'
export const OG_NOT_FOUND_CACHE_CONTROL = 'public, max-age=300, s-maxage=300'

export function isOgImagePath(pathname: string): boolean {
  return pathname === '/_og' || pathname.startsWith('/_og/')
}

export function handleOgImageError(error: H3Error, event: H3Event): Promise<void> | void {
  if (event.handled) return

  const pathname = parseURL(event.path).pathname
  if (!isOgImagePath(pathname)) return

  const statusCode = error.statusCode || 500
  removeResponseHeader(event, 'vary')
  setResponseHeader(event, 'content-type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'x-content-type-options', 'nosniff')

  if (statusCode >= 400 && statusCode < 500 && statusCode !== 408) {
    // Vercel Edge Network caches 404/410 responses, not 400/403.
    const cacheControl = statusCode === 404 ? OG_NOT_FOUND_CACHE_CONTROL : OG_INVALID_CACHE_CONTROL
    setResponseHeader(event, 'cache-control', cacheControl)
    setResponseStatus(event, 404, 'Not Found')
    return send(event, 'Not Found')
  }

  setResponseHeader(event, 'cache-control', 'no-store')
  setResponseStatus(event, statusCode)
  return send(event, 'Error')
}

export default function ogImageErrorHandler(error: H3Error, event: H3Event): Promise<void> | void {
  if (import.meta.dev || import.meta.prerender) return
  return handleOgImageError(error, event)
}
