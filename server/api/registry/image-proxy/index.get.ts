import { createError, getQuery, setResponseHeaders } from 'h3'
import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'
import { isAllowedImageUrl } from '#shared/utils/image-proxy'

/**
 * Image proxy endpoint to prevent privacy leaks from README images.
 *
 * Instead of letting the client's browser fetch images directly from third-party
 * servers (which exposes visitor IP, User-Agent, etc.), this endpoint fetches
 * images server-side and forwards them to the client.
 *
 * Similar to GitHub's camo proxy: https://github.blog/2014-01-28-proxying-user-images/
 *
 * Usage: /api/registry/image-proxy?url=https://example.com/image.png
 *
 * Resolves: https://github.com/npmx-dev/npmx.dev/issues/1138
 */
export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)
    const url = query.url as string | undefined

    if (!url) {
      throw createError({
        statusCode: 400,
        message: 'Missing required "url" query parameter.',
      })
    }

    // Validate URL
    if (!isAllowedImageUrl(url)) {
      throw createError({
        statusCode: 400,
        message: 'Invalid or disallowed image URL.',
      })
    }

    try {
      const response = await fetch(url, {
        headers: {
          // Use a generic User-Agent to avoid leaking server info
          'User-Agent': 'npmx-image-proxy/1.0',
          'Accept': 'image/*',
        },
        // Prevent redirects to non-HTTP protocols
        redirect: 'follow',
      })

      if (!response.ok) {
        throw createError({
          statusCode: response.status === 404 ? 404 : 502,
          message: `Failed to fetch image: ${response.status}`,
        })
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream'

      // Only allow image content types
      if (
        !contentType.startsWith('image/') &&
        !contentType.startsWith('application/octet-stream')
      ) {
        throw createError({
          statusCode: 400,
          message: 'URL does not point to an image.',
        })
      }

      // Enforce a maximum size of 10 MB to prevent abuse
      const contentLength = response.headers.get('content-length')
      const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
      if (contentLength && Number.parseInt(contentLength, 10) > MAX_SIZE) {
        throw createError({
          statusCode: 413,
          message: 'Image too large.',
        })
      }

      const imageBuffer = await response.arrayBuffer()

      // Check actual size
      if (imageBuffer.byteLength > MAX_SIZE) {
        throw createError({
          statusCode: 413,
          message: 'Image too large.',
        })
      }

      setResponseHeaders(event, {
        'Content-Type': contentType,
        'Content-Length': imageBuffer.byteLength.toString(),
        'Cache-Control': `public, max-age=${CACHE_MAX_AGE_ONE_DAY}, s-maxage=${CACHE_MAX_AGE_ONE_DAY}`,
        // Security headers - prevent content sniffing and restrict usage
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      })

      return Buffer.from(imageBuffer)
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
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      return `image-proxy:${query.url}`
    },
  },
)
