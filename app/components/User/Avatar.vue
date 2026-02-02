<script setup lang="ts">
const props = defineProps<{
  username: string
}>()

const { data: gravatarUrl } = useLazyFetch(() => `/api/gravatar/${props.username}`, {
  transform: res => (res.hash ? `/_avatar/${res.hash}?s=128&d=404` : null),
  getCachedData(key, nuxtApp) {
    return nuxtApp.static.data[key] ?? nuxtApp.payload.data[key]
  },
})
</script>

<template>
  <!-- Avatar -->
  <div
    class="size-16 shrink-0 rounded-full bg-bg-muted border border-border flex items-center justify-center overflow-hidden"
    role="img"
    :aria-label="`Avatar for ${username}`"
  >
    <!-- If Gravatar was fetched, display it -->
    <img
      v-if="gravatarUrl"
      :src="gravatarUrl"
      alt=""
      width="64"
      height="64"
      class="w-full h-full object-cover"
    />
    <!-- Else fallback to initials -->
    <span v-else class="text-2xl text-fg-subtle font-mono" aria-hidden="true">
      {{ username.charAt(0).toUpperCase() }}
    </span>
  </div>
</template>
