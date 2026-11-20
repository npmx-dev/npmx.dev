<script setup lang="ts">
import type { BrowseCollection, CollectionSummary } from '#shared/types/social'
import { CURATED_COLLECTION_DIDS } from '#shared/utils/constants'

const props = defineProps<{
  /** Browse's counts show when present */
  collection: CollectionSummary | BrowseCollection
  /** 3 by default, for lists under an h2 */
  headingLevel?: 2 | 3
}>()

const isCurated = computed(() => CURATED_COLLECTION_DIDS.has(props.collection.did))
const stats = computed(() => ('stats' in props.collection ? props.collection.stats : undefined))
</script>

<template>
  <NuxtLink
    :to="{
      name: 'collections-identifier-rkey',
      params: { identifier: collection.handle, rkey: collection.rkey },
    }"
    class="block h-full"
  >
    <BaseCard class="flex h-full flex-col gap-2 min-w-0">
      <div class="flex items-start justify-between gap-3 min-w-0">
        <component
          :is="`h${headingLevel ?? 3}`"
          class="font-mono text-base font-medium truncate min-w-0"
          :title="collection.name"
        >
          {{ collection.name }}
        </component>
        <CollectionCuratedBadge v-if="isCurated" class="shrink-0" />
      </div>
      <p class="font-mono text-sm text-fg-muted truncate">
        {{ $t('collections.by', { handle: collection.handle }) }}
      </p>
      <p v-if="collection.description" class="text-sm text-fg-muted line-clamp-2">
        {{ collection.description }}
      </p>
      <p
        class="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-fg-subtle"
      >
        <span>
          {{
            $t('collections.item_count', { count: $n(collection.itemCount) }, collection.itemCount)
          }}
        </span>
        <template v-if="stats">
          <span
            class="flex items-center gap-1"
            :title="$t('collections.like_count', { count: $n(stats.likes) }, stats.likes)"
          >
            <span class="i-lucide:heart size-3.5" aria-hidden="true" />
            <span aria-hidden="true">{{ $n(stats.likes) }}</span>
            <span class="sr-only">
              {{ $t('collections.like_count', { count: $n(stats.likes) }, stats.likes) }}
            </span>
          </span>
          <span
            class="flex items-center gap-1"
            :title="$t('collections.followers', { count: $n(stats.follows) }, stats.follows)"
          >
            <span class="i-lucide:bell size-3.5" aria-hidden="true" />
            <span aria-hidden="true">{{ $n(stats.follows) }}</span>
            <span class="sr-only">
              {{ $t('collections.followers', { count: $n(stats.follows) }, stats.follows) }}
            </span>
          </span>
          <span class="ms-auto flex items-center gap-1" :title="$t('collections.updated')">
            <span class="i-lucide:history size-3.5" aria-hidden="true" />
            <span class="sr-only">{{ $t('collections.updated') }}</span>
            <DateTime :datetime="stats.updatedAt" year="numeric" month="short" day="numeric" />
          </span>
        </template>
      </p>
    </BaseCard>
  </NuxtLink>
</template>
