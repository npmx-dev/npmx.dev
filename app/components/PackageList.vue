<script setup lang="ts">
import type { NpmSearchResult } from '#shared/types'
import type { WindowVirtualizerHandle } from '~/composables/useVirtualInfiniteScroll'
import type { ColumnConfig, PaginationMode, SortOption, ViewMode } from '#shared/types/preferences'
import { DEFAULT_COLUMNS } from '#shared/types/preferences'
import { WindowVirtualizer } from 'virtua/vue'

/** Number of items to render statically during SSR */
const SSR_COUNT = 20

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
  /** Search query for highlighting exact matches */
  searchQuery?: string
  /** View mode: cards or table */
  viewMode?: ViewMode
  /** Column configuration for table view */
  columns?: ColumnConfig[]
  /** Sort option for table header sorting */
  sortOption?: SortOption
  /** Pagination mode: infinite or paginated */
  paginationMode?: PaginationMode
  /** Current page (1-indexed) for paginated mode */
  currentPage?: number
}>()

const emit = defineEmits<{
  /** Emitted when scrolled near the bottom and more items should be loaded */
  'loadMore': []
  /** Emitted when the visible page changes */
  'pageChange': [page: number]
  /** Emitted when a result is hovered/focused */
  'select': [index: number]
  /** Emitted when sort option changes (table view) */
  'update:sortOption': [option: SortOption]
  /** Emitted when a keyword is clicked */
  'clickKeyword': [keyword: string]
}>()

// Reference to WindowVirtualizer for infinite scroll detection
const listRef = useTemplateRef<WindowVirtualizerHandle>('listRef')

// View mode and columns
const viewMode = computed(() => props.viewMode ?? 'cards')
const columns = computed(() => props.columns ?? DEFAULT_COLUMNS)
// Table view forces pagination mode (no virtualization for tables)
const paginationMode = computed(() =>
  viewMode.value === 'table' ? 'paginated' : (props.paginationMode ?? 'infinite'),
)
const currentPage = computed(() => props.currentPage ?? 1)

// Compute paginated results for paginated mode
const displayedResults = computed(() => {
  if (paginationMode.value === 'infinite') {
    return props.results
  }
  // 'all' page size means show everything (YOLO)
  if (pageSize.value === 'all') {
    return props.results
  }
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return props.results.slice(start, end)
})

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
    <!-- Table View -->
    <template v-if="viewMode === 'table'">
      <PackageTable
        :results="displayedResults"
        :columns="columns"
        :sort-option="sortOption"
        :selected-index="selectedIndex"
        :is-loading="isLoading"
        @update:sort-option="emit('update:sortOption', $event)"
        @select="emit('select', $event)"
        @click-keyword="emit('clickKeyword', $event)"
      />
    </template>

    <!-- Card View with Infinite Scroll -->
    <template v-else-if="paginationMode === 'infinite'">
      <!-- SSR: Render static list for first page, replaced by virtual list on client -->
      <ClientOnly>
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
                :search-query="searchQuery"
                class="motion-safe:animate-fade-in motion-safe:animate-fill-both"
                :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
                @focus="emit('select', $event)"
              />
            </div>
          </template>
        </WindowVirtualizer>

        <!-- SSR fallback: static list of first page results -->
        <template #fallback>
          <ol class="list-none m-0 p-0">
            <li v-for="(item, index) in results.slice(0, SSR_COUNT)" :key="item.package.name">
              <div class="pb-4">
                <PackageCard
                  :result="item"
                  :heading-level="headingLevel"
                  :show-publisher="showPublisher"
                  :selected="index === (selectedIndex ?? -1)"
                  :index="index"
                  :search-query="searchQuery"
                />
              </div>
            </li>
          </ol>
        </template>
      </ClientOnly>
    </template>

    <!-- Card View with Pagination -->
    <template v-else>
      <ol class="list-none m-0 p-0">
        <li v-for="(item, index) in displayedResults" :key="item.package.name" class="pb-4">
          <PackageCard
            :result="item"
            :heading-level="headingLevel"
            :show-publisher="showPublisher"
            :selected="index === (selectedIndex ?? -1)"
            :index="index"
            :search-query="searchQuery"
            class="motion-safe:animate-fade-in motion-safe:animate-fill-both"
            :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
            @focus="emit('select', $event)"
          />
        </li>
      </ol>
    </template>

    <!-- Initial loading state (card view only - table has its own skeleton) -->
    <div
      v-if="isLoading && results.length === 0 && viewMode !== 'table'"
      class="py-12 flex items-center justify-center"
    >
      <div class="flex items-center gap-3 text-fg-muted font-mono text-sm">
        <span
          class="w-5 h-5 border-2 border-fg-subtle border-t-fg rounded-full motion-safe:animate-spin"
        />
        {{ $t('common.loading') }}
      </div>
    </div>

    <!-- Loading more indicator (infinite scroll mode only) -->
    <div
      v-else-if="isLoading && paginationMode === 'infinite'"
      class="py-4 flex items-center justify-center"
    >
      <div class="flex items-center gap-3 text-fg-muted font-mono text-sm">
        <span
          class="w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full motion-safe:animate-spin"
        />
        {{ $t('common.loading_more') }}
      </div>
    </div>

    <!-- End of results (infinite scroll mode only) -->
    <p
      v-else-if="!hasMore && results.length > 0 && paginationMode === 'infinite'"
      class="py-4 text-center text-fg-subtle font-mono text-sm"
    >
      {{ $t('common.end_of_results') }}
    </p>

    <!-- Empty state (card view only - table has its own) -->
    <p
      v-if="results.length === 0 && !isLoading && viewMode !== 'table'"
      class="py-12 text-center text-fg-subtle font-mono text-sm"
    >
      {{ $t('filters.table.no_packages') }}
    </p>
  </div>
</template>
