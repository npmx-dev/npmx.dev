<script setup lang="ts">
import type { BlogPostFrontmatter } from '#shared/schemas/blog'

const props = defineProps<{
  frontmatter?: BlogPostFrontmatter
}>()

useSeoMeta({
  title: props.frontmatter?.title,
  description: props.frontmatter?.description || props.frontmatter?.excerpt,
  ogTitle: props.frontmatter?.title,
  ogDescription: props.frontmatter?.description || props.frontmatter?.excerpt,
  ogType: 'article',
})

// TODO: Hardcoded for testing - waiting on constellation/slingshot work
// Using Daniel Roe's post for testing: https://bsky.app/profile/danielroe.dev/post/3mcg6svsgsm2k
const BSKY_DID = 'did:plc:jbeaa5kdaladzwq3r7f5xgwe'
// const BSKY_DID = 'did:plc:5ixnpdbogli5f7fbbee5fmuq'
const BSKY_POST_ID = '3mcg6svsgsm2k'
// const BSKY_POST_ID = '3mdoijswyz22u'

const blueskyPostUri = computed(() =>
  BSKY_POST_ID ? `at://${BSKY_DID}/app.bsky.feed.post/${BSKY_POST_ID}` : null,
)
</script>

<template>
  <main class="container w-full py-8">
    <article class="prose dark:prose-invert mx-auto">
      <slot />
    </article>

    <LazyBlueskyComments v-if="blueskyPostUri" :post-uri="blueskyPostUri" />
  </main>
</template>
