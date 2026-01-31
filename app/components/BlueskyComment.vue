<script setup lang="ts">
import type { AppBskyRichtextFacet } from '@atproto/api'
import { segmentize } from '@atcute/bluesky-richtext-segmenter'
import type { Comment } from '#shared/types/blog-post'

type RichtextFeature =
  | AppBskyRichtextFacet.Link
  | AppBskyRichtextFacet.Mention
  | AppBskyRichtextFacet.Tag

function getCommentUrl(comment: Comment): string {
  return atUriToWebUrl(comment.uri) ?? '#'
}
const props = defineProps<{
  comment: Comment
  depth: number
}>()

const MaxDepth = 4

function getFeatureUrl(feature: RichtextFeature): string | undefined {
  if (feature.$type === 'app.bsky.richtext.facet#link') return feature.uri
  if (feature.$type === 'app.bsky.richtext.facet#mention')
    return `https://bsky.app/profile/${feature.did}`
  if (feature.$type === 'app.bsky.richtext.facet#tag')
    return `https://bsky.app/hashtag/${feature.tag}`
}

const processedSegments = segmentize(props.comment.text, props.comment.facets).map(segment => ({
  text: segment.text,
  url: segment.features?.[0] ? getFeatureUrl(segment.features[0] as RichtextFeature) : undefined,
}))

function getHostname(uri: string): string {
  try {
    return new URL(uri).hostname
  } catch {
    return uri
  }
}
</script>

<template>
  <div :class="depth === 0 ? 'flex gap-3' : 'flex gap-3 mt-3'">
    <!-- Avatar -->
    <a
      :href="`https://bsky.app/profile/${comment.author.handle}`"
      target="_blank"
      rel="noopener noreferrer"
      class="shrink-0"
    >
      <img
        v-if="comment.author.avatar"
        :src="comment.author.avatar"
        :alt="comment.author.displayName || comment.author.handle"
        :class="['rounded-full m-0', depth === 0 ? 'w-10 h-10' : 'w-8 h-8']"
        width="40"
        height="40"
        loading="lazy"
      />
      <div
        v-else
        :class="[
          'rounded-full bg-border flex items-center justify-center text-fg-muted',
          depth === 0 ? 'w-10 h-10' : 'w-8 h-8 text-sm',
        ]"
      >
        {{ (comment.author.displayName || comment.author.handle).charAt(0).toUpperCase() }}
      </div>
    </a>

    <div class="flex-1 min-w-0">
      <!-- Author info + timestamp -->
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0">
        <a
          :href="`https://bsky.app/profile/${comment.author.handle}`"
          target="_blank"
          rel="noopener noreferrer"
          class="font-medium text-fg hover:underline"
        >
          {{ comment.author.displayName || comment.author.handle }}
        </a>
        <span class="text-fg-subtle text-sm">@{{ comment.author.handle }}</span>
        <span class="text-fg-subtle text-sm">·</span>
        <a
          :href="getCommentUrl(props.comment)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-fg-subtle text-sm hover:underline"
        >
          <NuxtTime relative :datetime="comment.createdAt" />
        </a>
      </div>

      <!-- Comment text with rich segments -->
      <p class="text-fg-muted whitespace-pre-wrap">
        <template v-for="(segment, i) in processedSegments" :key="i">
          <a
            v-if="segment.url"
            :href="segment.url"
            target="_blank"
            rel="noopener noreferrer"
            class="link"
            >{{ segment.text }}</a
          >
          <template v-else>{{ segment.text }}</template>
        </template>
      </p>

      <!-- Embedded images -->
      <div
        v-if="comment.embed?.type === 'images' && comment.embed.images"
        class="flex flex-wrap gap-2"
      >
        <a
          v-for="(img, i) in comment.embed.images"
          :key="i"
          :href="img.fullsize"
          target="_blank"
          rel="noopener noreferrer"
          class="block"
        >
          <img
            :src="img.thumb"
            :alt="img.alt || 'Embedded image'"
            class="rounded-lg max-w-48 max-h-36 object-cover m-0"
            loading="lazy"
          />
        </a>
      </div>

      <!-- Embedded external link card -->
      <a
        v-if="comment.embed?.type === 'external' && comment.embed.external"
        :href="comment.embed.external.uri"
        target="_blank"
        rel="noopener noreferrer"
        class="flex gap-3 p-3 border border-border rounded-lg bg-bg-subtle hover:bg-bg-subtle/80 transition-colors no-underline"
      >
        <img
          v-if="comment.embed.external.thumb"
          :src="comment.embed.external.thumb"
          :alt="comment.embed.external.title"
          class="w-20 h-20 rounded object-cover shrink-0 m-0"
          loading="lazy"
        />
        <div class="min-w-0">
          <div class="font-medium text-fg truncate">
            {{ comment.embed.external.title }}
          </div>
          <div class="text-sm text-fg-muted line-clamp-2">
            {{ comment.embed.external.description }}
          </div>
          <div class="text-xs text-fg-subtle mt-1 truncate">
            {{ getHostname(comment.embed.external.uri) }}
          </div>
        </div>
      </a>

      <!-- Like/repost counts -->
      <div
        v-if="comment.likeCount > 0 || comment.repostCount > 0"
        class="mt-2 flex gap-4 text-sm text-fg-subtle"
      >
        <span v-if="comment.likeCount > 0">
          {{ comment.likeCount }} {{ comment.likeCount === 1 ? 'like' : 'likes' }}
        </span>
        <span v-if="comment.repostCount > 0">
          {{ comment.repostCount }} {{ comment.repostCount === 1 ? 'repost' : 'reposts' }}
        </span>
      </div>

      <!-- Nested replies -->
      <template v-if="comment.replies.length > 0">
        <div v-if="depth < MaxDepth" class="mt-2 pl-2 border-l-2 border-border flex flex-col">
          <BlueskyComment
            v-for="reply in comment.replies"
            :key="reply.uri"
            :comment="reply"
            :depth="depth + 1"
          />
        </div>
        <a
          v-else
          :href="getCommentUrl(comment.replies[0]!)"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 block text-sm link"
        >
          {{ comment.replies.length }} more
          {{ comment.replies.length === 1 ? 'reply' : 'replies' }}...
        </a>
      </template>
    </div>
  </div>
</template>
