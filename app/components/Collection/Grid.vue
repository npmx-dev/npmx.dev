<script setup lang="ts">
import type { CollectionSummary } from '#shared/types/social'

const {
  items,
  loadingMore,
  skeletons = 6,
} = defineProps<{
  items: CollectionSummary[]
  /** Shows skeletons while there are no items yet */
  pending: boolean
  loadingMore: boolean
  error: boolean
  hasMore: boolean
  emptyText: string
  skeletons?: number
  headingLevel?: 2 | 3
}>()

const emit = defineEmits<{ loadMore: [] }>()

// The button is replaced or unmounted as pages load, so move focus to the first new card
const listRef = useTemplateRef('list')
let firstNewIndex = -1
function loadMore() {
  if (loadingMore) return
  firstNewIndex = items.length
  emit('loadMore')
}
watch(
  () => loadingMore,
  async isLoading => {
    if (isLoading || firstNewIndex < 0) return
    const index = firstNewIndex
    firstNewIndex = -1
    await nextTick()
    listRef.value?.children[index]?.querySelector('a')?.focus()
  },
)
</script>

<template>
  <div
    v-if="pending && items.length === 0"
    class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
  >
    <SkeletonBlock v-for="i in skeletons" :key="i" class="h-32 rounded-lg" />
  </div>
  <p v-else-if="error && items.length === 0" role="alert" class="text-fg-muted">
    {{ $t('collections.load_error') }}
  </p>
  <p v-else-if="items.length === 0" class="text-fg-muted">{{ emptyText }}</p>
  <template v-else>
    <ul ref="list" class="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 lg:grid-cols-3">
      <li v-for="collection in items" :key="collection.uri">
        <CollectionCard :collection :heading-level="headingLevel" />
      </li>
    </ul>
    <p v-if="error" role="alert" class="text-fg-muted">{{ $t('collections.load_error') }}</p>
    <!-- aria-disabled, not disabled: disabling the focused button would drop focus to <body> -->
    <ButtonBase
      v-if="hasMore"
      class="self-center"
      :class="{ 'opacity-40 cursor-not-allowed': loadingMore }"
      :aria-disabled="loadingMore || undefined"
      @click="loadMore"
    >
      {{ loadingMore ? $t('common.loading_more') : $t('common.load_more') }}
    </ButtonBase>
  </template>
</template>
