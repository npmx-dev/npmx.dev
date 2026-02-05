<script setup lang="ts">
const router = useRouter()

import type { BlogPostFrontmatter } from '#shared/schemas/blog'
import { isModEventDivert } from '@atproto/api/dist/client/types/tools/ozone/moderation/defs'

const blogModules = import.meta.glob<BlogPostFrontmatter>('./*.md', { eager: true })

const posts: BlogPostFrontmatter[] = []

for (const [_, module] of Object.entries(blogModules)) {
  if (module.draft) continue

  posts.push({ ...module })
}

posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

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
        <div class="flex items-baseline justify-between gap-4 mb-4">
          <h1 class="font-mono text-3xl sm:text-4xl font-medium">
            {{ $t('blog.heading') }}
          </h1>
          <button
            type="button"
            class="inline-flex items-center gap-2 font-mono text-sm text-fg-muted hover:text-fg transition-colors duration-200 rounded focus-visible:outline-accent/70 shrink-0"
            @click="router.back()"
          >
            <span class="i-carbon:arrow-left rtl-flip w-4 h-4" aria-hidden="true" />
            <span class="hidden sm:inline">{{ $t('nav.back') }}</span>
          </button>
        </div>
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
            @focus="i => console.log('Hovered:', i)"
          />
          <hr v-if="idx < posts.length - 1" class="border-border-subtle" />
        </template>
        <!-- :selected="toSuggestionIndex(unifiedSelectedIndex) === idx" -->
        <!-- :is-exact-match="
                  (exactMatchType === 'org' && suggestion.type === 'org') ||
                  (exactMatchType === 'user' && suggestion.type === 'user')
                " -->
        <!-- @focus="handleBlogPostSelect" -->
        <!-- </div> -->
      </article>

      <isModEventDivert v-else class="text-center py-20 text-fg-subtle"
        >No posts found.</isModEventDivert
      >
    </article>
  </main>
</template>

<!--
// TODO: This should be extracted into a reusable form so search and blog post can both use it
// function scrollToSelectedItem() {
//   const pkgIndex = toPackageIndex(unifiedSelectedIndex.value)
//   if (pkgIndex !== null) {
//     packageListRef.value?.scrollToIndex(pkgIndex)
//   }
// }

// function focusSelectedItem() {
//   const suggIdx = toSuggestionIndex(unifiedSelectedIndex.value)
//   const pkgIdx = toPackageIndex(unifiedSelectedIndex.value)

//   nextTick(() => {
//     if (suggIdx !== null) {
//       const el = document.querySelector<HTMLElement>(`[data-suggestion-index="${suggIdx}"]`)
//       el?.focus()
//     } else if (pkgIdx !== null) {
//       scrollToSelectedItem()
//       nextTick(() => {
//         const el = document.querySelector<HTMLElement>(`[data-result-index="${pkgIdx}"]`)
//         el?.focus()
//       })
//     }
//   })
// }

// function handleResultsKeydown(e: KeyboardEvent) {
//   if (totalSelectableCount.value <= 0) return

//   const isFromInput = (e.target as HTMLElement).tagName === 'INPUT'

//   if (e.key === 'ArrowDown') {
//     e.preventDefault()
//     userHasNavigated.value = true
//     unifiedSelectedIndex.value = clampUnifiedIndex(unifiedSelectedIndex.value + 1)
//     if (isFromInput) {
//       scrollToSelectedItem()
//     } else {
//       focusSelectedItem()
//     }
//     return
//   }

//   if (e.key === 'ArrowUp') {
//     e.preventDefault()
//     userHasNavigated.value = true
//     unifiedSelectedIndex.value = clampUnifiedIndex(unifiedSelectedIndex.value - 1)
//     if (isFromInput) {
//       scrollToSelectedItem()
//     } else {
//       focusSelectedItem()
//     }
//     return
//   }

//   if (e.key === 'Enter') {
//     if (!resultsMatchQuery.value) return

//     const suggIdx = toSuggestionIndex(unifiedSelectedIndex.value)
//     const pkgIdx = toPackageIndex(unifiedSelectedIndex.value)

//     if (suggIdx !== null) {
//       const el = document.querySelector<HTMLElement>(`[data-suggestion-index="${suggIdx}"]`)
//       if (el) {
//         e.preventDefault()
//         el.click()
//       }
//     } else if (pkgIdx !== null) {
//       const el = document.querySelector<HTMLElement>(`[data-result-index="${pkgIdx}"]`)
//       if (el) {
//         e.preventDefault()
//         el.click()
//       }
//     }
//   }
// }

// function handleBlogPostSelect(index: number) {
//   // Convert suggestion index to unified index
//   unifiedSelectedIndex.value = -(suggestionCount.value - index)
// } -->
