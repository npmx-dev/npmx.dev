<script setup lang="ts">
import type { Author } from '#shared/schemas/blog'

const props = defineProps<{
  authors: Author[]
  variant?: 'compact' | 'expanded'
}>()

const { resolvedAuthors } = useAuthorProfiles(props.authors)
</script>

<template>
  <!-- Expanded variant: vertical list with larger avatars -->
  <div v-if="variant === 'expanded'" class="flex flex-wrap items-center gap-4">
    <div v-for="author in resolvedAuthors" :key="author.name" class="flex items-center gap-2">
      <AuthorAvatar :author="author" size="md" disable-link />
      <div class="flex flex-col">
        <span class="text-sm font-medium text-fg">{{ author.name }}</span>
        <a
          v-if="author.blueskyHandle && author.profileUrl"
          :href="author.profileUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-fg-muted hover:text-primary transition-colors"
        >
          @{{ author.blueskyHandle }}
        </a>
      </div>
    </div>
  </div>

  <!-- Compact variant: no avatars -->
  <div v-else class="flex items-center gap-2 min-w-0">
    <div class="flex items-center">
      <AuthorAvatar
        v-for="(author, index) in resolvedAuthors"
        :key="author.name"
        :author="author"
        size="md"
        class="ring-2 ring-bg"
        :class="index > 0 ? '-ms-3' : ''"
      />
    </div>
    <span class="text-xs text-fg-muted font-mono truncate">
      {{ resolvedAuthors.map(a => a.name).join(', ') }}
    </span>
  </div>
</template>
