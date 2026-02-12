<script setup lang="ts">
import { BLUESKY_EMBED_BASE_ROUTE } from '#shared/utils/constants'
import type { BlueskyOEmbedResponse } from '#shared/schemas/atproto'

const { url } = defineProps<{
  url: string
}>()

const embeddedId = String(Math.random()).slice(2)
const iframeHeight = ref(300)

// INFO: Strictly eager client-side fetch (server: false & lazy: true)
const { data: embedData, status } = useLazyAsyncData<BlueskyOEmbedResponse>(
  `bluesky-embed-${embeddedId}`,
  () =>
    $fetch('/api/atproto/bluesky-oembed', {
      query: { url, colorMode: 'system' },
    }),
  {
    // INFO: Redundant with .client.vue but included for surety that SSR is not attempted
    server: false,
    immediate: true,
  },
)

// INFO: Computed URL with Unique ID appended for postMessage handshake, must be stable per component instance
const embedUrl = computed<string | null>(() => {
  if (!embedData.value?.embedUrl) return null
  return `${embedData.value.embedUrl}&id=${embeddedId}`
})

const isLoading = computed(() => status.value === 'pending')

// INFO: REQUIRED - listener must attach after mount b/c window.postMessage only exists in the browser and the random ID must match between hydration and mount
onMounted(() => {
  window.addEventListener('message', onPostMessage)
})

onUnmounted(() => {
  window.removeEventListener('message', onPostMessage)
})

function onPostMessage(event: MessageEvent) {
  if (event.origin !== BLUESKY_EMBED_BASE_ROUTE) return
  if (event.data?.id !== embeddedId) return
  if (typeof event.data?.height === 'number') {
    iframeHeight.value = event.data.height
  }
}
</script>

<template>
  <article class="bluesky-embed-container">
    <!-- Loading state -->
    <LoadingSpinner
      v-if="isLoading"
      :text="$t('blog.atproto.loading_bluesky_post')"
      aria-label="Loading Bluesky post..."
      class="loading-spinner"
    />

    <!-- Success state -->
    <div v-else-if="embedUrl" class="bluesky-embed-container">
      <iframe
        :data-bluesky-id="embeddedId"
        :src="embedUrl"
        width="100%"
        :height="iframeHeight"
        frameborder="0"
        scrolling="no"
      />
    </div>

    <!-- Fallback state -->
    <a v-else :href="url" target="_blank" rel="noopener noreferrer">
      {{ $t('blog.atproto.view_on_bluesky') }}
    </a>
  </article>
</template>

<style scoped>
.bluesky-embed-container {
  /* INFO: Matches Bluesky's internal max-width */
  max-width: 37.5rem;
  width: 100%;
  margin: 1.5rem 0;
  /* INFO: Necessary to remove the white 1px line at the bottom of the embed. Also sets border-radius  */
  clip-path: inset(0 0 1px 0 round 0.75rem);
}

.bluesky-embed-container > .loading-spinner {
  margin: 0 auto;
}
</style>
