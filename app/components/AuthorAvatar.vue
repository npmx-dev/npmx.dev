<script setup lang="ts">
import type { ResolvedAuthor } from '#shared/schemas/blog'

const props = defineProps<{
  author: ResolvedAuthor
  size?: 'sm' | 'md' | 'lg'
  disableLink?: boolean
}>()

const { t } = useI18n()

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

const isLink = computed(() => !props.disableLink && props.author.profileUrl)
const ariaLabel = computed(() => t('blog.author.view_profile', { name: props.author.name }))
</script>

<template>
  <component
    :is="isLink ? 'a' : 'div'"
    :href="isLink ? author.profileUrl : undefined"
    :target="isLink ? '_blank' : undefined"
    :rel="isLink ? 'noopener noreferrer' : undefined"
    :aria-label="isLink ? ariaLabel : undefined"
    class="shrink-0 flex items-center justify-center border border-border rounded-full bg-bg-muted overflow-hidden"
    :class="[sizeClasses, { 'hover:border-primary transition-colors': isLink }]"
    :title="author.name"
  >
    <span v-if="!isLink" class="sr-only">{{ author.name }}</span>
    <img
      v-if="author.avatar"
      :src="author.avatar"
      :alt="author.name"
      class="w-full h-full object-cover"
    />
    <span v-else class="text-fg-subtle font-mono" aria-hidden="true">
      {{ initials }}
    </span>
  </component>
</template>
