<script setup lang="ts">
import type { CollectionSummary } from '#shared/types/social'
import { parseCollectionQuery } from '~/utils/atproto/collections'

type Page = { cursor?: string; total?: number; items: CollectionSummary[] }

const route = useRoute('collections')

// Three views share this page: browse everything, collections containing a package,
// and collections including another collection.
const packageName = computed(() =>
  typeof route.query.package === 'string' ? route.query.package : '',
)
const includes = computed(() => parseCollectionQuery(route.query.includes))
const SORTS = ['recent', 'liked', 'followed'] as const
const sort = computed(() => SORTS.find(s => s !== 'recent' && s === route.query.sort) ?? 'recent')
const sortLabels = computed(() => ({
  recent: $t('collections.sort_recent'),
  liked: $t('collections.sort_liked'),
  followed: $t('collections.sort_followed'),
}))

// Our own links use DIDs, which the AT-URI needs
const containing = computed(() => {
  if (packageName.value) return PACKAGE_SUBJECT_REF(packageName.value)
  if (includes.value) return COLLECTION_SUBJECT_REF(includes.value.identifier, includes.value.rkey)
  return null
})
const isBrowsing = computed(() => !containing.value)
const endpoint = computed(() =>
  isBrowsing.value ? '/api/social/collections/browse' : '/api/social/collections/containing',
)
const baseQuery = computed(() =>
  isBrowsing.value ? { sort: sort.value } : { subject: containing.value },
)

const { data, status, error } = await useFetch<Page>(endpoint, { query: baseQuery })

const isLoadingMore = shallowRef(false)
async function loadMore() {
  const current = data.value
  if (!current?.cursor || isLoadingMore.value) return
  isLoadingMore.value = true
  try {
    const page = await $fetch<Page>(endpoint.value, {
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

const heading = computed(() => {
  if (packageName.value)
    return $t('collections.containing_package_title', { name: packageName.value })
  if (includes.value) return $t('collections.including_title')
  return $t('collections.title')
})

useSeoMeta({
  title: () => $t('collections.meta_title'),
  ogTitle: () => $t('collections.meta_title'),
  twitterTitle: () => $t('collections.meta_title'),
  description: () => $t('collections.meta_description'),
  ogDescription: () => $t('collections.meta_description'),
  twitterDescription: () => $t('collections.meta_description'),
})

defineOgImage(
  'Page.takumi',
  {
    title: () => $t('collections.title'),
    description: () => $t('collections.tagline'),
  },
  { alt: () => $t('collections.meta_description') },
)
</script>

<template>
  <main class="container flex-1 flex flex-col gap-8 py-12 sm:py-16 w-full">
    <header class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex flex-col gap-4">
        <h1 class="font-mono text-3xl sm:text-4xl font-medium">{{ heading }}</h1>
        <p v-if="isBrowsing" class="text-fg-muted text-lg">{{ $t('collections.tagline') }}</p>
        <CollectionYourData v-if="isBrowsing" />
      </div>
      <LinkBase
        variant="button-primary"
        classicon="i-lucide:plus"
        :to="{ name: 'collections-new' }"
      >
        {{ $t('collections.new') }}
      </LinkBase>
    </header>

    <nav v-if="isBrowsing" :aria-label="$t('collections.sort_label')">
      <ButtonGroup>
        <LinkBase
          v-for="option in SORTS"
          :key="option"
          :variant="sort === option ? 'button-primary' : 'button-secondary'"
          :to="{ name: 'collections', query: option === 'recent' ? {} : { sort: option } }"
          :aria-current="sort === option ? 'page' : undefined"
        >
          {{ sortLabels[option] }}
        </LinkBase>
      </ButtonGroup>
    </nav>

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
