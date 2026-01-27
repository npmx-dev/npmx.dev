<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types'
import type { WindowVirtualizerHandle } from '~/composables/useVirtualInfiniteScroll'
import { WindowVirtualizer } from 'virtua/vue'

const props = defineProps<{
  /** List of search results to display */
  results: NpmSearchResult[]
  /** Heading level for package names */
  headingLevel?: 'h2' | 'h3'
  /** Whether to show publisher username on cards */
  showPublisher?: boolean
  /** Whether there are more items to load */
  hasMore?: boolean
  /** Whether currently loading more items */
  isLoading?: boolean
  /** Page size for tracking current page */
  pageSize?: number
  /** Initial page to scroll to (1-indexed) */
  initialPage?: number
  /** Selected result index (for keyboard navigation) */
  selectedIndex?: number
}>()

const emit = defineEmits<{
  /** Emitted when scrolled near the bottom and more items should be loaded */
  loadMore: []
  /** Emitted when the visible page changes */
  pageChange: [page: number]
  /** Emitted when a result is hovered/focused */
  select: [index: number]
}>()

// Reference to WindowVirtualizer for infinite scroll detection
const listRef = useTemplateRef<WindowVirtualizerHandle>('listRef')

// Set up infinite scroll if hasMore is provided
const hasMore = computed(() => props.hasMore ?? false)
const isLoading = computed(() => props.isLoading ?? false)
const itemCount = computed(() => props.results.length)
const pageSize = computed(() => props.pageSize ?? 20)

const { handleScroll, scrollToPage } = useVirtualInfiniteScroll({
  listRef,
  itemCount,
  hasMore,
  isLoading,
  pageSize: pageSize.value,
  threshold: 5,
  onLoadMore: () => emit('loadMore'),
  onPageChange: page => emit('pageChange', page),
})

// Scroll to initial page once list is ready and has items
const hasScrolledToInitial = shallowRef(false)

watch(
  [() => props.results.length, () => props.initialPage, listRef],
  ([length, initialPage, list]) => {
    if (!hasScrolledToInitial.value && list && length > 0 && initialPage && initialPage > 1) {
      // Wait for next tick to ensure list is rendered
      nextTick(() => {
        scrollToPage(initialPage)
        hasScrolledToInitial.value = true
      })
    }
  },
  { immediate: true },
)

// Reset scroll state when results change significantly (new search)
watch(
  () => props.results,
  (newResults, oldResults) => {
    // If this looks like a new search (different first item or much shorter), reset
    if (
      !oldResults ||
      newResults.length === 0 ||
      (oldResults.length > 0 && newResults[0]?.package.name !== oldResults[0]?.package.name)
    ) {
      hasScrolledToInitial.value = false
    }
  },
)

function scrollToIndex(index: number, smooth = true) {
  listRef.value?.scrollToIndex(index, { align: 'center', smooth })
}

defineExpose({
  scrollToIndex,
})
</script>

<template>
  <div>
    <WindowVirtualizer
      ref="listRef"
      :data="results"
      :item-size="140"
      as="ol"
      item="li"
      class="list-none m-0 p-0"
      @scroll="handleScroll"
    >
      <template #default="{ item, index }">
        <div class="pb-4">
          <PackageCard
            :result="item as NpmSearchResult"
            :heading-level="headingLevel"
            :show-publisher="showPublisher"
            :selected="index === (selectedIndex ?? -1)"
            :index="index"
            class="motion-safe:animate-fade-in motion-safe:animate-fill-both"
            :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
            @focus="emit('select', $event)"
          />
        </div>
      </template>
    </WindowVirtualizer>

    <!-- Loading indicator -->
    <div v-if="isLoading" class="py-4 flex items-center justify-center">
      <div class="flex items-center gap-3 text-fg-muted font-mono text-sm">
        <span
          class="w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full motion-safe:animate-spin"
        />
        {{ $t('common.loading_more') }}
      </div>
    </div>

    <!-- End of results -->
    <p
      v-else-if="!hasMore && results.length > 0"
      class="py-4 text-center text-fg-subtle font-mono text-sm"
    >
      {{ $t('common.end_of_results') }}
    </p>
  </div>
</template>
