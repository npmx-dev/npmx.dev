<script setup lang="ts">
import type { AppBskyFeedGetLikes, AppBskyEmbedImages, AppBskyEmbedExternal } from '@atproto/api'
import type { Comment, CommentEmbed } from '#shared/types/blog-post'
import { AppBskyFeedDefs } from '@atproto/api'

type PostView = AppBskyFeedDefs.PostView
type ThreadViewPost = AppBskyFeedDefs.ThreadViewPost
type EmbedImages = AppBskyEmbedImages.View
type EmbedExternal = AppBskyEmbedExternal.View
type Likes = AppBskyFeedGetLikes.Like

const props = defineProps<{
  postUri: string
}>()

const BSKY_API = 'https://public.api.bsky.app/xrpc/'

const postUrl = computed(() => atUriToWebUrl(props.postUri))

// Parse embed from Bluesky API response
function parseEmbed(embed: PostView['embed']): CommentEmbed | undefined {
  if (!embed) return undefined

  if (embed.$type === 'app.bsky.embed.images#view') {
    const imagesEmbed = embed as EmbedImages
    return {
      type: 'images',
      images: imagesEmbed.images,
    }
  }

  if (embed.$type === 'app.bsky.embed.external#view') {
    const externalEmbed = embed as EmbedExternal
    return {
      type: 'external',
      external: externalEmbed.external,
    }
  }

  return undefined
}

// Parse thread data into Comment type
function parseThread(thread: ThreadViewPost): Comment | null {
  if (!AppBskyFeedDefs.isThreadViewPost(thread)) return null
  const post = thread.post
  const record = post.record as { text: string; createdAt: string; facets?: Comment['facets'] }

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
    text: record.text || '',
    facets: record.facets,
    embed: parseEmbed(post.embed),
    createdAt: record.createdAt,
    likeCount: post.likeCount || 0,
    replyCount: post.replyCount || 0,
    repostCount: post.repostCount || 0,
    replies,
  }
}

// Fetch thread data using useFetch
const {
  data: thread,
  pending,
  error: threadError,
} = useFetch(`${BSKY_API}app.bsky.feed.getPostThread`, {
  query: { uri: props.postUri, depth: 10 },
  lazy: true,
  server: false,
  transform: (response: { thread: ThreadViewPost }) => parseThread(response.thread),
})

// Fetch Likes
const likes = computed(() => likesInfo.value?.likes || [])
const totalLikes = computed(() => likesInfo.value?.totalLikes || 0)

const { data: likesInfo } = useAsyncData(
  `bsky-likes-${props.postUri}`,
  async () => {
    const encodedUri = encodeURIComponent(props.postUri)

    // Default getLikes limit is 50. We use it in conjunction with getPosts
    // to show remaining likes
    const [postData, likesData] = await Promise.all([
      $fetch<{ posts: { likeCount?: number }[] }>(`${BSKY_API}app.bsky.feed.getPosts`, {
        query: { uris: props.postUri },
      }),
      $fetch<{ likes: Likes[] }>(`${BSKY_API}app.bsky.feed.getLikes`, {
        query: { uri: props.postUri },
      }),
    ])

    return {
      likes: likesData.likes,
      totalLikes: postData.posts?.[0]?.likeCount,
    }
  },
  { lazy: true, server: false },
)
</script>

<template>
  <section class="mt-12 pt-8 border-t border-border max-w-prose mx-auto">
    <!-- Likes -->
    <div v-if="likesInfo && likes.length > 0" class="mb-8">
      <h3 class="text-lg font-semibold text-fg mb-4">Likes on Bluesky ({{ totalLikes }})</h3>
      <ul class="flex flex-wrap gap-1 list-none p-0 m-0">
        <li v-for="like in likes" :key="like.actor.did" class="m-0 p-0">
          <a
            :href="`https://bsky.app/profile/${like.actor.handle}`"
            target="_blank"
            rel="noopener noreferrer"
            :title="like.actor.displayName || like.actor.handle"
          >
            <img
              v-if="like.actor.avatar"
              :src="like.actor.avatar"
              :alt="like.actor.displayName || like.actor.handle"
              class="w-8 h-8 rounded-full hover:opacity-80 transition-opacity m-0"
            />
            <div
              v-else
              class="w-8 h-8 rounded-full bg-bg-subtle flex items-center justify-center text-fg-muted text-xs"
            >
              {{ (like.actor.displayName || like.actor.handle).charAt(0).toUpperCase() }}
            </div>
          </a>
        </li>
        <li
          v-if="totalLikes > likes.length"
          class="flex items-center text-fg-muted text-sm m-0 p-0 pl-2"
        >
          <a
            v-if="postUrl"
            :href="postUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="link ml-auto"
          >
            +{{ totalLikes - likes.length }} more
          </a>
        </li>
      </ul>
    </div>

    <!-- Comments Section -->
    <div class="mb-8">
      <h3 class="text-lg font-semibold text-fg mb-4">Comments</h3>

      <!-- Loading state -->
      <div v-if="pending" class="flex items-center gap-2 text-fg-muted">
        <span class="i-svg-spinners:90-ring-with-bg h-5 w-5" />
        <span>Loading comments...</span>
      </div>

      <!-- Error state -->
      <div v-else-if="threadError" class="text-fg-muted">
        Could not load comments.
        <a v-if="postUrl" :href="postUrl" target="_blank" rel="noopener noreferrer" class="link">
          View on Bluesky
        </a>
      </div>

      <!-- No comments -->
      <div v-else-if="!thread || thread.replies.length === 0">
        <p class="text-fg-muted mb-4">No comments yet.</p>
        <a v-if="postUrl" :href="postUrl" target="_blank" rel="noopener noreferrer" class="link">
          Reply on Bluesky
        </a>
      </div>

      <!-- Comments list -->
      <div v-else class="flex flex-col gap-6">
        <div class="flex items-center gap-4 text-sm text-fg-muted">
          <span>{{ thread.replyCount }} {{ thread.replyCount === 1 ? 'reply' : 'replies' }}</span>
          <a
            v-if="postUrl"
            :href="postUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="link ml-auto"
          >
            Reply on Bluesky
          </a>
        </div>

        <BlueskyComment
          v-for="reply in thread.replies"
          :key="reply.uri"
          :comment="reply"
          :depth="0"
        />
        <a
          v-if="postUrl"
          :href="postUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="link inline-flex items-center gap-2"
        >
          Like this post or add your comment on Bluesky
          <span class="i-carbon:arrow-right" aria-hidden="true" />
        </a>
      </div>
    </div>
  </section>
</template>
