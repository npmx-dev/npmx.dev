import type { $Typed, AtUriString, Unknown$TypedObject } from '@atproto/lex'
import { Client, isAtUriString } from '@atproto/lex'
import type { Comment, CommentEmbed } from '#shared/types/blog-post'
import * as app from '#shared/types/lexicons/app'
import {
  CACHE_MAX_AGE_ONE_MINUTE,
  BLUESKY_API,
  BSKY_POST_AT_URI_REGEX,
} from '#shared/utils/constants'

const blueskyClient = new Client({ service: BLUESKY_API })

/**
 * Provides both build and runtime comments refreshes
 * During build, cache aggressively to avoid rate limits
 * During runtime, refresh cache once every minute
 */
export default defineCachedEventHandler(
  async event => {
    const { uri } = getQuery(event)

    if (typeof uri !== 'string' || !isAtUriString(uri)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid URI format: Must be a valid at:// URI`,
      })
    }

    try {
      // Fetch thread, likes, and post metadata in parallel
      const [threadResponse, likesResponse, postsResponse] = await Promise.all([
        blueskyClient.call(app.bsky.feed.getPostThread, { uri, depth: 10 }).catch((err: Error) => {
          console.warn(`[Bluesky] Thread fetch failed for ${uri}:`, err.message)
          return null
        }),

        blueskyClient.call(app.bsky.feed.getLikes, { uri, limit: 50 }).catch(() => ({ likes: [] })),

        blueskyClient.call(app.bsky.feed.getPosts, { uris: [uri] }).catch(() => ({ posts: [] })),
      ])

      // Early return if thread fetch fails w/o 404
      if (!threadResponse) {
        return {
          thread: null,
          likes: [],
          totalLikes: 0,
          postUrl: atUriToWebUrl(uri),
          _empty: true,
        }
      }

      const thread = parseThread(threadResponse.thread)

      return {
        thread,
        likes: likesResponse.likes,
        totalLikes: postsResponse.posts?.[0]?.likeCount ?? thread?.likeCount ?? 0,
        postUrl: atUriToWebUrl(uri),
      }
    } catch (error) {
      // Fail open during build to prevent build breakage
      console.error('[Bluesky] Unexpected error:', error)
      return {
        thread: null,
        likes: [],
        totalLikes: 0,
        postUrl: atUriToWebUrl(uri),
        _error: true,
      }
    }
  },
  {
    name: 'bluesky-comments',
    maxAge: CACHE_MAX_AGE_ONE_MINUTE,
    getKey: event => {
      const { uri } = getQuery(event)
      return `bluesky:${uri}`
    },
  },
)

// Helper to convert AT URI to web URL
function atUriToWebUrl(uri: AtUriString): string | null {
  const match = uri.match(BSKY_POST_AT_URI_REGEX)
  if (!match) return null
  const [, did, rkey] = match as [string, `did:plc:${string}`, string]
  return `https://bsky.app/profile/${did}/post/${rkey}`
}

function parseEmbed(embed: app.bsky.feed.defs.PostView['embed']): CommentEmbed | undefined {
  if (!embed) return undefined

  if (app.bsky.embed.images.view.$isTypeOf(embed)) {
    return {
      type: 'images',
      images: embed.images,
    }
  }

  if (app.bsky.embed.external.view.$isTypeOf(embed)) {
    return {
      type: 'external',
      external: embed.external,
    }
  }

  return undefined
}

function parseThread(
  thread:
    | Unknown$TypedObject
    | $Typed<app.bsky.feed.defs.ThreadViewPost>
    | $Typed<app.bsky.feed.defs.NotFoundPost>
    | $Typed<app.bsky.feed.defs.BlockedPost>,
): Comment | null {
  if (!app.bsky.feed.defs.threadViewPost.$isTypeOf(thread)) return null

  const { post } = thread

  const recordValidation = app.bsky.feed.post.$safeValidate(post.record)

  if (!recordValidation.success) return null
  const record = recordValidation.value

  const replies: Comment[] = []
  if (thread.replies) {
    for (const reply of thread.replies) {
      if (app.bsky.feed.defs.threadViewPost.$isTypeOf(reply)) {
        const parsed = parseThread(reply)
        if (parsed) replies.push(parsed)
      }
    }
    replies.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }

  return {
    uri: post.uri,
    cid: post.cid,
    author: {
      did: post.author.did,
      handle: post.author.handle,
      displayName: post.author.displayName,
      avatar: post.author.avatar,
    },
    text: record.text,
    facets: record.facets,
    embed: parseEmbed(post.embed),
    createdAt: record.createdAt,
    likeCount: post.likeCount ?? 0,
    replyCount: post.replyCount ?? 0,
    repostCount: post.repostCount ?? 0,
    replies,
  }
}
