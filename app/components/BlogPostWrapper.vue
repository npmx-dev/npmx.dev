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
})

const slug = computed(() => props.frontmatter.slug)

// Use Constellation to find the Bluesky post linking to this blog post
const { data: blueskyLink } = await useBlogPostBlueskyLink(slug)
const blueskyPostUri = computed(() => blueskyLink.value?.postUri ?? null)
</script>

<template>
  <main class="container w-full py-8">
    <article
      class="max-w-prose mx-auto p-2 border-b border-border"
      :style="{
        background: `linear-gradient(to bottom, transparent 0%, var(--bg-blog) 2%, var(--bg-blog) 94%, transparent 100%)`,
      }"
    >
      <slot />
    </article>
    <article v-if="frontmatter.authors" class="mt-12 max-w-prose mx-auto">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <AuthorList :authors="frontmatter.authors" variant="expanded" />
      </div>
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
