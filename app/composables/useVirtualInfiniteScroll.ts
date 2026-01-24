import type { Ref } from 'vue'

export interface WindowVirtualizerHandle {
  readonly scrollOffset: number
  readonly viewportSize: number
  findItemIndex: (offset: number) => number
  getItemOffset: (index: number) => number
  scrollToIndex: (index: number, opts?: { align?: 'start' | 'center' | 'end' }) => void
}

export interface UseVirtualInfiniteScrollOptions {
  /** Reference to the WindowVirtualizer component */
  listRef: Ref<WindowVirtualizerHandle | undefined>
  /** Current item count */
  itemCount: Ref<number>
  /** Whether there are more items to load */
  hasMore: Ref<boolean>
  /** Whether currently loading */
  isLoading: Ref<boolean>
  /** Page size for calculating current page */
  pageSize: number
  /** Threshold in items before end to trigger load */
  threshold?: number
  /** Callback to load more items */
  onLoadMore: () => void
  /** Callback when visible page changes (for URL updates) */
  onPageChange?: (page: number) => void
}

/**
 * Composable for handling infinite scroll with virtua's WindowVirtualizer
 * Detects when user scrolls near the end and triggers loading more items
 * Also tracks current visible page for URL persistence
 */
export function useVirtualInfiniteScroll(options: UseVirtualInfiniteScrollOptions) {
  const {
    listRef,
    itemCount,
    hasMore,
    isLoading,
    pageSize,
    threshold = 5,
    onLoadMore,
    onPageChange,
  } = options

  // Track last fetched count to prevent duplicate fetches
  const fetchedCountRef = ref(-1)

  // Track current page to avoid unnecessary updates
  const currentPage = ref(1)

  function handleScroll() {
    const list = listRef.value
    if (!list) return

    // Calculate current visible page based on first visible item
    const startIndex = list.findItemIndex(list.scrollOffset)
    const newPage = Math.floor(startIndex / pageSize) + 1

    if (newPage !== currentPage.value && onPageChange) {
      currentPage.value = newPage
      onPageChange(newPage)
    }

    // Don't fetch if already loading or no more items
    if (isLoading.value || !hasMore.value) return

    // Don't fetch if we already fetched at this count
    const count = itemCount.value
    if (fetchedCountRef.value >= count) return

    // Check if we're near the end
    const endOffset = list.scrollOffset + list.viewportSize
    const endIndex = list.findItemIndex(endOffset)

    if (endIndex + threshold >= count) {
      fetchedCountRef.value = count
      onLoadMore()
    }
  }

  /**
   * Scroll to a specific page (1-indexed)
   * Call this after data is loaded to restore scroll position
   */
  function scrollToPage(page: number) {
    const list = listRef.value
    if (!list || page < 1) return

    const targetIndex = (page - 1) * pageSize
    list.scrollToIndex(targetIndex, { align: 'start' })
    currentPage.value = page
  }

  // Reset state when item count changes significantly (new search)
  watch(itemCount, (newCount, oldCount) => {
    // If count decreased or reset, clear the fetched tracking
    if (newCount < oldCount || newCount === 0) {
      fetchedCountRef.value = -1
      currentPage.value = 1
    }
  })

  return {
    handleScroll,
    scrollToPage,
    currentPage,
  }
}
