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
</script>

<template>
  <article
    class="group relative hover:bg-bg-subtle transition-colors duration-150 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-bg focus-within:ring-offset-2 focus-within:ring-fg/50 -mx-4 px-4 -my-2 py-2 sm:-mx-6 sm:px-6 sm:-my-3 sm:py-3 sm:rounded-md"
  >
    <NuxtLink
      :to="`/blog/${path}`"
      :data-suggestion-index="index"
      class="flex items-center gap-4 focus-visible:outline-none after:content-[''] after:absolute after:inset-0"
    >
      <!-- Text Content -->
      <div class="flex-1 min-w-0 text-start gap-2">
        <span class="text-xs text-fg-muted font-mono">{{ published }}</span>
        <h2
          class="font-mono text-xl font-medium text-fg group-hover:text-primary transition-colors hover:underline"
        >
          {{ title }}
        </h2>
        <p v-if="excerpt" class="text-fg-muted leading-relaxed line-clamp-2 no-underline">
          {{ excerpt }}
        </p>
        <div class="flex flex-wrap items-center gap-2 text-xs text-fg-muted font-mono mt-4">
          <AuthorList :authors="authors" />
        </div>
      </div>

      <span
        class="i-carbon:arrow-right w-4 h-4 text-fg-subtle group-hover:text-fg relative inset-is-0 group-hover:inset-is-1 transition-all duration-200 shrink-0"
        aria-hidden="true"
      />
    </NuxtLink>
  </article>
</template>
