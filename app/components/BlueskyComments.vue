<script setup lang="ts">
const props = defineProps<{
  postUri: string
}>()

// Since we need this to work isomorphically across SSR/build & client runtime fetch comments via server API
const { data, pending, error } = useBlueskyComments(() => props.postUri)

const thread = computed(() => data.value?.thread)
const likes = computed(() => data.value?.likes ?? [])
const totalLikes = computed(() => data.value?.totalLikes ?? 0)
const postUrl = computed(() => data.value?.postUrl)
</script>

<template>
  <section class="mt-12 pt-8 border-t border-border max-w-prose mx-auto">
    <!-- Likes -->
    <div v-if="likes.length > 0" class="mb-8">
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
          class="flex items-center text-fg-muted text-sm m-0 p-0 ps-2"
        >
          <a
            v-if="postUrl"
            :href="postUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="link ms-auto"
          >
            +{{ totalLikes - likes.length }} more
          </a>
        </li>
      </ul>
    </div>

    <!-- Comments Section -->
    <div class="mb-8">
      <h3 class="text-lg font-semibold text-fg mb-4">Comments</h3>

      <!-- Build-time/Initial loading -->
      <div v-if="pending && !thread" class="flex items-center gap-2 text-fg-muted" role="status">
        <span class="i-svg-spinners:90-ring-with-bg h-5 w-5" aria-hidden="true" />
        <span>Loading comments...</span>
      </div>

      <!-- Background refresh indicator -->
      <div v-else-if="pending && thread" class="text-xs text-fg-subtle mb-4 animate-pulse">
        Updating...
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-fg-muted">
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

      <!-- Comments Thread -->
      <div v-else class="flex flex-col gap-6">
        <div class="flex items-center gap-4 text-sm text-fg-muted">
          <span>{{ thread.replyCount }} {{ thread.replyCount === 1 ? 'reply' : 'replies' }}</span>
          <a
            v-if="postUrl"
            :href="postUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="link ms-auto"
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
