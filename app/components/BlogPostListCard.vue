<script setup lang="ts">
import type { Author } from '#shared/schemas/blog'

defineProps<{
  /** Authors of the blog post */
  authors: Author[]
  /** Blog Title */
  title: string
  /** Tags such as OpenSource, Architecture, Community, etc. */
  topics: string[]
  /** Brief line from the text. */
  excerpt: string
  /** The datetime value (ISO string or Date) */
  published: string
  /** Path/Slug of the post */
  path: string
  /** For keyboard nav scaffold */
  index: number
}>()

const emit = defineEmits<{
  focus: [index: number]
}>()
</script>

<template>
  <article
    class="group relative focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50"
  >
    <NuxtLink
      :to="`/blog/${path}`"
      :data-suggestion-index="index"
      class="flex items-center gap-4 focus-visible:outline-none after:content-[''] after:absolute after:inset-0"
      @focus="index != null && emit('focus', index)"
      @mouseenter="index != null && emit('focus', index)"
    >
      <!-- Text Content -->
      <div class="flex-1 min-w-0 text-left">
        <span class="text-xs text-fg-muted font-mono">{{ published }}</span>
        <h2
          class="font-mono text-xl font-medium text-fg group-hover:text-primary transition-colors hover:underline"
        >
          {{ title }}
        </h2>
        <p v-if="excerpt" class="text-fg-muted leading-relaxed line-clamp-2 no-underline">
          {{ excerpt }}
        </p>
        <div class="flex flex-wrap items-center gap-2 text-xs text-fg-muted font-mono">
          <AuthorList :authors="authors" />
        </div>
      </div>

      <span
        class="i-carbon:arrow-right w-4 h-4 text-fg-subtle group-hover:text-fg transition-colors shrink-0"
        aria-hidden="true"
      />
    </NuxtLink>
  </article>
</template>
