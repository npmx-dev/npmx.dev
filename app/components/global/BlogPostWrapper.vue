<script setup lang="ts">
import type { BlogPostFrontmatter } from '#shared/schemas/blog'

const props = defineProps<{
  frontmatter: BlogPostFrontmatter
}>()

useSeoMeta({
  title: props.frontmatter.title,
  description: props.frontmatter.description || props.frontmatter.excerpt,
  ogTitle: props.frontmatter.title,
  ogDescription: props.frontmatter.description || props.frontmatter.excerpt,
  ogType: 'article',
  ...(props.frontmatter.draft ? { robots: 'noindex, nofollow' } : {}),
})

defineOgImageComponent('BlogPost', {
  title: props.frontmatter.title,
  authors: props.frontmatter.authors,
  date: props.frontmatter.date,
})

const slug = computed(() => props.frontmatter.slug)

// Use Constellation to find the Bluesky post linking to this blog post
const { data: blueskyLink } = await useBlogPostBlueskyLink(slug)
const blueskyPostUri = computed(() => blueskyLink.value?.postUri ?? null)
</script>

<template>
  <main class="container w-full py-8">
    <div
      v-if="frontmatter.draft"
      class="max-w-prose mx-auto mb-8 px-4 py-3 rounded-md border border-badge-orange/30 bg-badge-orange/5"
    >
      <div class="flex items-center gap-2 text-badge-orange">
        <span class="i-lucide:file-edit w-4 h-4 shrink-0" aria-hidden="true" />
        <span class="text-sm font-medium">
          {{ $t('blog.draft_banner') }}
        </span>
      </div>
    </div>
    <div v-if="frontmatter.authors" class="mb-12 max-w-prose mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <AuthorList :authors="frontmatter.authors" variant="expanded" />
      </div>
    </div>
    <article class="max-w-prose mx-auto p-2 prose dark:prose-invert">
      <div class="text-sm text-fg-muted font-mono mb-4">
        <DateTime :datetime="frontmatter.date" year="numeric" month="short" day="numeric" />
      </div>
      <slot />
    </article>

    <!--
      - Only renders if Constellation found a Bluesky post linking to this slug
      - Cached API route avoids rate limits during build
    -->
    <LazyBlueskyComments v-if="blueskyPostUri" :post-uri="blueskyPostUri" />
  </main>
</template>

<style scoped>
:deep(.markdown-body) {
  @apply prose dark:prose-invert;
}
</style>
