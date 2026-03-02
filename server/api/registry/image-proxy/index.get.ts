import { createError, getQuery, setResponseHeaders, sendStream } from 'h3'
import { Readable } from 'node:stream'
import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'
import {
  isAllowedImageUrl,
  resolveAndValidateHost,
  verifyImageUrl,
} from '#server/utils/image-proxy'

/** Fetch timeout in milliseconds to prevent slow-drip resource exhaustion */
const FETCH_TIMEOUT_MS = 15_000

/** Maximum image size in bytes (10 MB) */
const MAX_SIZE = 10 * 1024 * 1024

/** Maximum number of redirects to follow manually */
const MAX_REDIRECTS = 5

/** HTTP status codes that indicate a redirect */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/**
 * Image proxy endpoint to prevent privacy leaks from README images.
 *
 * Instead of letting the client's browser fetch images directly from third-party
 * servers (which exposes visitor IP, User-Agent, etc.), this endpoint fetches
 * images server-side and forwards them to the client.
 *
 * Similar to GitHub's camo proxy: https://github.blog/2014-01-28-proxying-user-images/
 *
 * Usage: /api/registry/image-proxy?url=https://example.com/image.png&sig=<hmac>
 *
 * The `sig` parameter is an HMAC-SHA256 signature of the URL, generated server-side
 * during README rendering. This prevents the endpoint from being used as an open proxy.
 *
 * Resolves: https://github.com/npmx-dev/npmx.dev/issues/1138
 */
export default defineEventHandler(async event => {
  const query = getQuery(event)
  const rawUrl = query.url
  const url = (Array.isArray(rawUrl) ? rawUrl[0] : rawUrl) as string | undefined
  const sig = (Array.isArray(query.sig) ? query.sig[0] : query.sig) as string | undefined

  if (!url) {
    throw createError({
      statusCode: 400,
      message: 'Missing required "url" query parameter.',
    })
  }

  if (!sig) {
    throw createError({
      statusCode: 400,
      message: 'Missing required "sig" query parameter.',
    })
  }

  // Verify HMAC signature to ensure this URL was generated server-side
  const { imageProxySecret } = useRuntimeConfig()
  if (!imageProxySecret || !verifyImageUrl(url, sig, imageProxySecret)) {
    throw createError({
      statusCode: 403,
      message: 'Invalid signature.',
    })
  }

  // Validate URL syntactically
  if (!isAllowedImageUrl(url)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or disallowed image URL.',
    })
  }

  // Resolve hostname via DNS and validate the resolved IP is not private.
  // This prevents DNS rebinding attacks where a hostname resolves to a private IP.
  if (!(await resolveAndValidateHost(url))) {
    throw createError({
      statusCode: 400,
      message: 'Invalid or disallowed image URL.',
    })
  }

  try {
    // Manually follow redirects so we can validate each hop before connecting.
    // Using `redirect: 'follow'` would let fetch connect to internal IPs via redirects
    // before we could validate them (TOCTOU issue).
    let currentUrl = url
    let response: Response | undefined

    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'npmx-image-proxy/1.0',
          'Accept': 'image/*',
        },
        redirect: 'manual',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      })

      if (!REDIRECT_STATUSES.has(response.status)) {
        break
      }

      const location = response.headers.get('location')
      if (!location) {
        break
      }

      // Resolve relative redirect URLs against the current URL
      const redirectUrl = new URL(location, currentUrl).href

      // Validate the redirect target before following it
      if (!isAllowedImageUrl(redirectUrl)) {
        throw createError({
          statusCode: 400,
          message: 'Redirect to disallowed URL.',
        })
      }

      if (!(await resolveAndValidateHost(redirectUrl))) {
        throw createError({
          statusCode: 400,
          message: 'Redirect to disallowed URL.',
        })
      }

      // Consume the redirect response body to free resources
      await response.body?.cancel()
      currentUrl = redirectUrl
    }

    if (!response) {
      throw createError({
        statusCode: 502,
        message: 'Failed to fetch image.',
      })
    }

    // Check if we exhausted the redirect limit
    if (REDIRECT_STATUSES.has(response.status)) {
      await response.body?.cancel()
      throw createError({
        statusCode: 502,
        message: 'Too many redirects.',
      })
    }

    if (!response.ok) {
      await response.body?.cancel()
      throw createError({
        statusCode: response.status === 404 ? 404 : 502,
        message: `Failed to fetch image: ${response.status}`,
      })
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream'

    // Allow raster/vector image content types (we don't inject external content into DOM, so SVG is allowed too)
    if (!contentType.startsWith('image/')) {
      await response.body?.cancel()
      throw createError({
        statusCode: 400,
        message: 'URL does not point to an allowed image type.',
      })
    }

    // Check Content-Length header if present (may be absent or dishonest)
    const contentLength = response.headers.get('content-length')
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_SIZE) {
      await response.body?.cancel()
      throw createError({
        statusCode: 413,
        message: 'Image too large.',
      })
    }

    if (!response.body) {
      throw createError({
        statusCode: 502,
        message: 'No response body from upstream.',
      })
    }

    // Do not forward upstream Content-Length since we may truncate the stream
    // at MAX_SIZE, which would cause a mismatch with the declared length.
    setResponseHeaders(event, {
      'Content-Type': contentType,
      'Cache-Control': `public, max-age=${CACHE_MAX_AGE_ONE_DAY}, s-maxage=${CACHE_MAX_AGE_ONE_DAY}`,
      // Security headers - prevent content sniffing and restrict usage
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
    })

    // Stream the response with a size limit to prevent memory exhaustion.
    // Uses pipe-based backpressure so the upstream pauses when the consumer is slow.
    let bytesRead = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upstream = Readable.fromWeb(response.body as any)
    const limited = new Readable({
      read() {
        // Resume the upstream when the consumer is ready for more data
        upstream.resume()
      },
    })

    upstream.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length
      if (bytesRead > MAX_SIZE) {
        upstream.destroy()
        limited.destroy(new Error('Image too large'))
      } else {
        // Respect backpressure: if push() returns false, pause the upstream
        // until the consumer calls read() again
        if (!limited.push(chunk)) {
          upstream.pause()
        }
      }
    })
    upstream.on('end', () => limited.push(null))
    upstream.on('error', (err: Error) => limited.destroy(err))

    return sendStream(event, limited)
  } catch (error: unknown) {
    // Re-throw H3 errors
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 502,
      message: 'Failed to proxy image.',
    })
  }
})
