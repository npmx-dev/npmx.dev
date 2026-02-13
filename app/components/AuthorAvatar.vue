<script setup lang="ts">
import type { ResolvedAuthor } from '#shared/schemas/blog'

const props = defineProps<{
  author: ResolvedAuthor
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = computed(() => {
  switch (props.size ?? 'md') {
    case 'sm':
      return 'w-8 h-8 text-sm'
    case 'lg':
      return 'w-12 h-12 text-xl'
    default:
      return 'w-10 h-10 text-lg'
  }
})

const initials = computed(() =>
  props.author.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2),
)
</script>

<template>
  <div
    class="shrink-0 flex items-center justify-center border border-border rounded-full bg-bg-muted overflow-hidden"
    :class="[sizeClasses]"
  >
    <img
      v-if="author.avatar"
      :src="author.avatar"
      :alt="author.name"
      class="w-full h-full object-cover"
    />
    <span v-else class="text-fg-subtle font-mono" aria-hidden="true">
      {{ initials }}
    </span>
  </div>
</template>
