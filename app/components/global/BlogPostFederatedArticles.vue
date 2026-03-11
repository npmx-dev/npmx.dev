<script setup lang="ts">
import type { FederatedArticleInput } from '#shared/types/blog-post'
import type { Author } from '#shared/schemas/blog'
import type { AtIdentifierString } from '@atproto/lex'

const props = defineProps<{
  headline: string
  articles: FederatedArticleInput[]
}>()

// Prepare authors list for the composable
const authors = computed<Author[]>(() =>
  props.articles.map(article => ({
    name: article.authorHandle,
    blueskyHandle: article.authorHandle as AtIdentifierString,
  })),
)

// Fetch author profiles for avatars
const { resolvedAuthors } = useBlueskyAuthorProfiles(authors.value)

// Merge the input data with the fetched avatars
const federatedArticles = computed(() => {
  return props.articles.map((article, index) => {
    const profile = resolvedAuthors.value[index]

    return {
      url: article.url,
      title: article.title,
      description: article.description,
      authorHandle: article.authorHandle,
      author: {
        name: profile?.name || article.authorHandle,
        blueskyHandle: article.authorHandle as AtIdentifierString,
        avatar: profile?.avatar || null,
        profileUrl: profile?.profileUrl || null,
      },
    }
  })
})
</script>

<template>
  <aside class="px-4 sm:-mx-6 sm:px-6 sm:-my-3 sm:py-3 sm:rounded-md">
    <h2 class="font-mono text-xl font-medium text-fg mt-0">
      {{ headline }}
    </h2>
    <div
      v-if="federatedArticles.length"
      class="grid gap-4 grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] transition-[grid-template-cols]"
    >
      <a
        :href="article.url"
        target="_blank"
        rel="noopener noreferrer"
        v-for="article in federatedArticles"
        :key="article.url"
        class="grid grid-cols-[auto_1fr] gap-x-5 no-underline hover:no-underline rounded-lg border border-border p-4 transition-shadow hover:shadow-lg hover:shadow-gray-500/50"
      >
        <AuthorAvatar v-if="article.author" :author="article.author" size="md" class="row-span-2" />
        <div class="flex flex-col">
          <p class="text-lg text-fg leading-tight m-0">
            {{ article.title }}
          </p>
          <p class="text-md font-semibold text-fg-muted leading-none mt-2">
            {{ article.author.name }}
          </p>
          <p class="text-sm text-fg-subtle leading-snug m-0">
            {{ article.description }}
          </p>
        </div>
      </a>
    </div>
  </aside>
</template>
