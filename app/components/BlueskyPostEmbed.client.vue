<script setup lang="ts">
import { BLUESKY_API, BSKY_POST_AT_URI_REGEX } from '#shared/utils/constants'

const props = defineProps<{
  /** AT URI of the post, e.g. at://did:plc:.../app.bsky.feed.post/... */
  uri: string
}>()

interface PostAuthor {
  did: string
  handle: string
  displayName?: string
  avatar?: string
}

interface EmbedImage {
  thumb: string
  fullsize: string
  alt: string
  aspectRatio?: { width: number; height: number }
}

interface BlueskyPost {
  uri: string
  author: PostAuthor
  record: { text: string; createdAt: string }
  embed?: { $type: string; images?: EmbedImage[] }
  likeCount?: number
  replyCount?: number
  repostCount?: number
}

const postUrl = computed(() => {
  const match = props.uri.match(BSKY_POST_AT_URI_REGEX)
  if (!match) return null
  const [, did, rkey] = match
  return `https://bsky.app/profile/${did}/post/${rkey}`
})

const { data: post, status } = useAsyncData(
  `bsky-post-${props.uri}`,
  async (): Promise<BlueskyPost | null> => {
    const response = await $fetch<{ posts: BlueskyPost[] }>(
      `${BLUESKY_API}/xrpc/app.bsky.feed.getPosts`,
      { query: { uris: props.uri } },
    )
    return response.posts[0] ?? null
  },
  { lazy: true, server: false },
)
</script>

<template>
  <div
    v-if="status === 'pending'"
    class="rounded-lg border border-border bg-bg-subtle p-6 text-center text-fg-subtle text-sm"
  >
    <span class="i-svg-spinners:90-ring-with-bg h-5 w-5 inline-block" />
  </div>

  <a
    v-else-if="post"
    :href="postUrl ?? '#'"
    target="_blank"
    rel="noopener noreferrer"
    class="block rounded-lg border border-border bg-bg-subtle p-4 sm:p-5 no-underline hover:border-border-hover transition-colors duration-200"
  >
    <!-- Author row -->
    <div class="flex items-center gap-3 mb-3">
      <img
        v-if="post.author.avatar"
        :src="`${post.author.avatar}?size=48`"
        :alt="post.author.displayName || post.author.handle"
        width="40"
        height="40"
        class="w-10 h-10 rounded-full"
        loading="lazy"
      />
      <div class="min-w-0">
        <div class="font-medium text-fg truncate">
          {{ post.author.displayName || post.author.handle }}
        </div>
        <div class="text-sm text-fg-subtle truncate">@{{ post.author.handle }}</div>
      </div>
      <span
        class="i-simple-icons:bluesky w-5 h-5 text-fg-subtle ms-auto shrink-0"
        aria-hidden="true"
      />
    </div>

    <!-- Post text -->
    <p class="text-fg-muted whitespace-pre-wrap leading-relaxed mb-3">{{ post.record.text }}</p>

    <!-- Embedded images -->
    <template v-if="post.embed?.images?.length">
      <img
        v-for="(img, i) in post.embed.images"
        :key="i"
        :src="img.fullsize"
        :alt="img.alt"
        class="w-full mb-3 rounded-lg object-cover"
        :style="
          img.aspectRatio
            ? { aspectRatio: `${img.aspectRatio.width}/${img.aspectRatio.height}` }
            : undefined
        "
        loading="lazy"
      />
    </template>

    <!-- Timestamp + engagement -->
    <div class="flex items-center gap-4 text-sm text-fg-subtle">
      <DateTime :datetime="post.record.createdAt" date-style="medium" />
      <span v-if="post.likeCount" class="flex items-center gap-1">
        <span class="i-lucide:heart w-3.5 h-3.5" aria-hidden="true" />
        {{ post.likeCount }}
      </span>
      <span v-if="post.repostCount" class="flex items-center gap-1">
        <span class="i-lucide:repeat w-3.5 h-3.5" aria-hidden="true" />
        {{ post.repostCount }}
      </span>
      <span v-if="post.replyCount" class="flex items-center gap-1">
        <span class="i-lucide:message-circle w-3.5 h-3.5" aria-hidden="true" />
        {{ post.replyCount }}
      </span>
    </div>
  </a>
</template>
