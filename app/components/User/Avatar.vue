<script setup lang="ts">
const props = defineProps<{
  username: string
  size: 'xs' | 'lg'
}>()

const sizePixels = computed(() => {
  switch (props.size) {
    case 'xs':
      return 24
    case 'lg':
      return 64
  }
})

const sizeClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'size-6'
    case 'lg':
      return 'size-16'
  }
})

const textClass = computed(() => {
  switch (props.size) {
    case 'xs':
      return 'text-xs'
    case 'lg':
      return 'text-2xl'
  }
})

const { data: gravatarUrl } = useLazyFetch(
  () => `/api/gravatar/${encodeURIComponent(props.username)}`,
  {
    transform: res => (res.hash ? `/_avatar/${res.hash}?s=128&d=404` : null),
    getCachedData(key, nuxtApp) {
      return nuxtApp.static.data[key] ?? nuxtApp.payload.data[key]
    },
  },
)
</script>

<template>
  <!-- Avatar -->
  <div
    class="shrink-0 rounded-full bg-bg-muted border border-border flex items-center justify-center overflow-hidden"
    :class="sizeClass"
    role="img"
    :aria-label="`Avatar for ${username}`"
  >
    <!-- If Gravatar was fetched, display it -->
    <img
      v-if="gravatarUrl"
      :src="gravatarUrl"
      alt=""
      :width="sizePixels"
      :height="sizePixels"
      class="w-full h-full object-cover"
    />
    <!-- Else fall back to initials (use svg to avoid underline styling) -->
    <svg
      v-else
      xmlns="http://www.w3.org/2000/svg"
      :width="sizePixels"
      :height="sizePixels"
      class="text-fg-subtle"
      :class="textClass"
    >
      <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="currentColor">
        {{ username.charAt(0).toUpperCase() }}
      </text>
    </svg>
  </div>
</template>
