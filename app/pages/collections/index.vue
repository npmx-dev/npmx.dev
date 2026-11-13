<script setup lang="ts">
import type { CollectionSummary } from '#shared/types/social'
import { parseCollectionQuery } from '~/utils/atproto/collections'

type Page = { cursor?: string; total?: number; items: CollectionSummary[] }

const route = useRoute('collections')

// Collections containing a package, or including another collection
const packageName = computed(() =>
  typeof route.query.package === 'string' ? route.query.package : '',
)
const includes = computed(() => parseCollectionQuery(route.query.includes))

// Our own links use DIDs, which the AT-URI needs
const containing = computed(() => {
  if (packageName.value) return PACKAGE_SUBJECT_REF(packageName.value)
  if (includes.value) return COLLECTION_SUBJECT_REF(includes.value.identifier, includes.value.rkey)
  return null
})
if (!containing.value) throw createError({ statusCode: 404 })
const endpoint = '/api/social/collections/containing'
const baseQuery = computed(() => ({ subject: containing.value }))

const { data, status, error } = await useFetch<Page>(endpoint, { query: baseQuery })

const isLoadingMore = shallowRef(false)
async function loadMore() {
  const current = data.value
  if (!current?.cursor || isLoadingMore.value) return
  isLoadingMore.value = true
  try {
    const page = await $fetch<Page>(endpoint, {
      query: { ...baseQuery.value, cursor: current.cursor },
    })
    // The query changed while loading, so this page belongs to the old one
    if (data.value !== current) return
    // useFetch data is a shallow ref, so replace rather than mutate
    data.value = { ...current, cursor: page.cursor, items: [...current.items, ...page.items] }
  } finally {
    isLoadingMore.value = false
  }
}

const heading = computed(() =>
  packageName.value
    ? $t('collections.containing_package_title', { name: packageName.value })
    : $t('collections.including_title'),
)

useSeoMeta({
  title: heading,
  ogTitle: heading,
  twitterTitle: heading,
})
</script>

<template>
  <main class="container flex-1 flex flex-col gap-8 py-12 sm:py-16 w-full">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <h1 class="font-mono text-3xl sm:text-4xl font-medium">{{ heading }}</h1>
      <LinkBase
        variant="button-primary"
        classicon="i-lucide:plus"
        :to="{ name: 'collections-new' }"
      >
        {{ $t('collections.new') }}
      </LinkBase>
    </header>

    <CollectionGrid
      :items="data?.items ?? []"
      :pending="status === 'pending'"
      :loading-more="isLoadingMore"
      :error="!!error"
      :has-more="!!data?.cursor"
      :empty-text="$t('collections.empty')"
      :heading-level="2"
      @load-more="loadMore"
    />
  </main>
</template>
