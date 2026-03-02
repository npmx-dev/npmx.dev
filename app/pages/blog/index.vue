<script setup lang="ts">
import { posts } from '#blog/posts'

const placeHolder = ['atproto', 'nuxt']

definePageMeta({
  name: 'blog',
})

useSeoMeta({
  title: () => `${$t('blog.title')} - npmx`,
  ogTitle: () => `${$t('blog.title')} - npmx`,
  twitterTitle: () => `${$t('blog.title')} - npmx`,
  description: () => $t('blog.meta_description'),
  ogDescription: () => $t('blog.meta_description'),
  twitterDescription: () => $t('blog.meta_description'),
})
</script>

<template>
  <main class="container w-full flex-1 py-12 sm:py-16 overflow-x-hidden">
    <article class="max-w-2xl mx-auto">
      <header class="mb-12">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium">
          {{ $t('blog.heading') }}
        </h1>
        <p class="text-fg-muted text-lg">
          {{ $t('tagline') }}
        </p>
      </header>
      <article v-if="posts && posts.length > 0" class="flex flex-col gap-8">
        <template
          v-for="(post, idx) in posts"
          :key="`${post.authors.map(a => a.name).join('-')}-${post.title}`"
        >
          <BlogPostListCard
            :authors="post.authors"
            :title="post.title"
            :path="post.slug"
            :excerpt="post.excerpt || post.description || 'No Excerpt Available'"
            :topics="Array.isArray(post.tags) ? post.tags : placeHolder"
            :published="post.date"
            :index="idx"
          />
          <hr v-if="idx < posts.length - 1" class="border-border-subtle" />
        </template>
      </article>

      <p v-else class="text-center py-20 text-fg-subtle">No posts found.</p>
    </article>
  </main>
</template>
