import { parse } from 'valibot'
import { handleApiError } from '#server/utils/error-handler'
import {
  CACHE_MAX_AGE_ONE_MINUTE,
  BLUESKY_API,
  BLUESKY_EMBED_BASE_ROUTE,
  ERROR_BLUESKY_EMBED_FAILED,
  BLUESKY_URL_EXTRACT_REGEX,
} from '#shared/utils/constants'
import { type BlueskyOEmbedResponse, BlueskyOEmbedRequestSchema } from '#shared/schemas/atproto'

export default defineCachedEventHandler(
  async (event): Promise<BlueskyOEmbedResponse> => {
    try {
      const query = getQuery(event)
      const { url, colorMode } = parse(BlueskyOEmbedRequestSchema, query)

      /**
       * INFO: Extract handle and post ID from https://bsky.app/profile/HANDLE/post/POST_ID
       * Casting type here because the schema has already validated the URL format before this line runs.
       * If the schema passes, this regex is mathematically guaranteed to match and contain both capture groups.
       * Match returns ["profile/danielroe.dev/post/123", "danielroe.dev", "123"] — only want the two capture groups, the full match string is discarded.
       */
      const [, handle, postId] = url.match(BLUESKY_URL_EXTRACT_REGEX)! as [string, string, string]

      // INFO: Resolve handle to DID using Bluesky's public API
      const { did } = await $fetch<{ did: string }>(
        `${BLUESKY_API}com.atproto.identity.resolveHandle`,
        {
          query: { handle },
        },
      )

      // INFO: Construct the embed URL with the DID
      const embedUrl = `${BLUESKY_EMBED_BASE_ROUTE}/embed/${did}/app.bsky.feed.post/${postId}?colorMode=${colorMode}`

      return {
        embedUrl,
        did,
        postId,
        handle,
      }
    } catch (error) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_BLUESKY_EMBED_FAILED,
      })
    }
  },
  {
    name: 'bluesky-oembed',
    maxAge: CACHE_MAX_AGE_ONE_MINUTE,
    getKey: event => {
      const { url, colorMode } = getQuery(event)
      return `oembed:${url}:${colorMode ?? 'system'}`
    },
  },
)
