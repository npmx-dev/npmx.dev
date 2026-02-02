<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    username: string
    size?: 'sm' | 'md' | 'lg'
  }>(),
  {
    size: 'lg',
  },
)

const { data: gravatarUrl } = useLazyFetch(() => `/api/gravatar/${props.username}`, {
  transform: res => (res.hash ? `/_avatar/${res.hash}?s=128&d=404` : null),
  getCachedData(key, nuxtApp) {
    return nuxtApp.static.data[key] ?? nuxtApp.payload.data[key]
  },
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'size-10 text-lg'
    case 'md':
      return 'size-14 text-2xl'
    default:
      return 'size-16 text-2xl'
  }
})
</script>

<template>
  <!-- Avatar -->
  <div
    class="shrink-0 rounded-full bg-bg-muted border border-border flex items-center justify-center overflow-hidden"
    :class="sizeClasses"
    role="img"
    :aria-label="`Avatar for ${username}`"
  >
    <!-- If Gravatar was fetched, display it -->
    <img v-if="gravatarUrl" :src="gravatarUrl" alt="" class="w-full h-full object-cover" />
    <!-- Else fallback to initials -->
    <span v-else class="text-fg-subtle font-mono" aria-hidden="true">
      {{ username.charAt(0).toUpperCase() }}
    </span>
  </div>
</template>
