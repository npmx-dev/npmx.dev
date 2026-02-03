import { safeParse, flatten } from 'valibot'
import type { Comment, CommentEmbed } from '#shared/types/blog-post'
import {
  AppBskyFeedDefs,
  AppBskyFeedPost,
  AppBskyEmbedImages,
  AppBskyEmbedExternal,
} from '@atproto/api'
import { BlueSkyUriSchema } from '#shared/schemas/atproto'
import { CACHE_MAX_AGE_ONE_MINUTE, BLUESKY_API, AT_URI_REGEX } from '#shared/utils/constants'

import { jsonToLex } from '@atproto/api'

type ThreadResponse = { thread: AppBskyFeedDefs.ThreadViewPost }

type LikesResponse = {
  likes: Array<{
    actor: {
      did: string
      handle: string
      displayName?: string
      avatar?: string
    }
  }>
}

type PostsResponse = { posts: Array<{ likeCount?: number }> }

/**
 * Provides both build and runtime comments refreshes
 * During build, cache aggressively to avoid rate limits
 * During runtime, refresh cache once every minute
 */
export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)
    const parsed = safeParse(BlueSkyUriSchema, query)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid URI format: ${flatten(parsed.issues).root?.[0] || 'Must be a valid at:// URI'}`,
      })
    }

    const { uri } = parsed.output

    try {
      // Fetch thread, likes, and post metadata in parallel
      const [threadResponse, likesResponse, postsResponse] = await Promise.all([
        $fetch<ThreadResponse>(`${BLUESKY_API}app.bsky.feed.getPostThread`, {
          query: { uri, depth: 10 },
        }).catch((err: Error) => {
          console.warn(`[Bluesky] Thread fetch failed for ${uri}:`, err.message)
          return null
        }),

        $fetch<LikesResponse>(`${BLUESKY_API}app.bsky.feed.getLikes`, {
          query: { uri, limit: 50 },
        }).catch(() => ({ likes: [] })),

        $fetch<PostsResponse>(`${BLUESKY_API}app.bsky.feed.getPosts`, {
          query: { uris: [uri] },
        }).catch(() => ({ posts: [] })),
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
        likes: likesResponse.likes || [],
        totalLikes: postsResponse.posts?.[0]?.likeCount || thread?.likeCount || 0,
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
function atUriToWebUrl(uri: string): string | null {
  const match = uri.match(AT_URI_REGEX)
  if (!match) return null
  const [, did, rkey] = match
  return `https://bsky.app/profile/${did}/post/${rkey}`
}

function parseEmbed(embed: AppBskyFeedDefs.PostView['embed']): CommentEmbed | undefined {
  if (!embed) return undefined

  if (AppBskyEmbedImages.isView(embed)) {
    return {
      type: 'images',
      images: embed.images,
    }
  }

  if (AppBskyEmbedExternal.isView(embed)) {
    return {
      type: 'external',
      external: embed.external,
    }
  }

  return undefined
}

function parseThread(thread: AppBskyFeedDefs.ThreadViewPost): Comment | null {
  if (!AppBskyFeedDefs.isThreadViewPost(thread)) return null

  const { post } = thread

  // This casts our external.thumb as a blobRef which is needed to validateRecord
  const lexPostRecord = jsonToLex(post.record)
  const recordValidation = AppBskyFeedPost.validateRecord(lexPostRecord)

  if (!recordValidation.success) return null
  const record = recordValidation.value

  const replies: Comment[] = []
  if (thread.replies) {
    for (const reply of thread.replies) {
      if (AppBskyFeedDefs.isThreadViewPost(reply)) {
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
