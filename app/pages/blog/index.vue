<script setup lang="ts">
import type { BlogPostFrontmatter } from '#shared/schemas/blog'

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
  // alias: ['/:path(.*)*'],
})

useSeoMeta({
  title: () => $t('blog.title'),
  description: () => $t('blog.description'),
})
</script>

<template>
  <main class="container py-8 sm:py-12 w-full">
    <header class="mb-8 pb-8 border-b border-border flex place-content-center text-3xl">
      <h1 class="">blog...</h1>
    </header>

    <article v-if="posts && posts.length > 0" class="mx-30 space-y-4">
      <BlogPostListCard
        v-for="(post, idx) in posts"
        :key="`${post.authors.map(a => a.name).join('-')}-${post.title}`"
        :authors="post.authors"
        :title="post.title"
        :path="post.slug"
        :excerpt="post.excerpt || post.description || 'No Excerpt Available'"
        :topics="Array.isArray(post.tags) ? post.tags : placeHolder"
        :published="post.date"
        :index="idx"
        @focus="i => console.log('Hovered:', i)"
      />
      <!-- :selected="toSuggestionIndex(unifiedSelectedIndex) === idx" -->
      <!-- :is-exact-match="
                (exactMatchType === 'org' && suggestion.type === 'org') ||
                (exactMatchType === 'user' && suggestion.type === 'user')
              " -->
      <!-- @focus="handleBlogPostSelect" -->
      <!-- </div> -->
    </article>

    <article v-else class="text-center py-20 text-fg-subtle">No posts found.</article>
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
