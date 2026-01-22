<script setup lang="ts">
import { formatNumber } from '#imports'
import { debounce } from 'perfect-debounce'

const route = useRoute()
const router = useRouter()

// Local input value (updates immediately as user types)
const inputValue = ref((route.query.q as string) ?? '')

// Debounced URL update
const updateUrlQuery = debounce((value: string) => {
  router.replace({ query: { q: value || undefined } })
}, 250)

// Watch input and debounce URL updates
watch(inputValue, (value) => {
  updateUrlQuery(value)
})

// The actual search query (from URL, used for API calls)
const query = computed(() => (route.query.q as string) ?? '')

// Sync input with URL when navigating (e.g., back button)
watch(() => route.query.q, (urlQuery) => {
  const value = (urlQuery as string) ?? ''
  if (inputValue.value !== value) {
    inputValue.value = value
  }
})

// For glow effect
const isSearchFocused = ref(false)
const searchInputRef = ref<HTMLInputElement>()

// Track if page just loaded (for hiding "Searching..." during view transition)
const hasInteracted = ref(false)
onMounted(() => {
  // Small delay to let view transition complete
  setTimeout(() => {
    hasInteracted.value = true
  }, 300)
})

// Infinite scroll state
const pageSize = 20
const loadedPages = ref(1)
const isLoadingMore = ref(false)
const loadMoreTrigger = ref<HTMLElement>()

// Get initial page from URL (for hard reload persistence)
const initialPage = computed(() => {
  const p = Number.parseInt(route.query.page as string, 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

// Track if we need to scroll to restored position
const needsScrollRestore = ref(false)

// Initialize loaded pages from URL on mount
onMounted(() => {
  if (initialPage.value > 1) {
    loadedPages.value = initialPage.value
    needsScrollRestore.value = true
  }
  // Focus search input
  searchInputRef.value?.focus()
})

// fetch all pages up to current
const { data: results, status } = useNpmSearch(query, () => ({
  size: pageSize * loadedPages.value,
  from: 0,
}))

// Keep track of previous results to show while loading
const previousQuery = ref('')
const cachedResults = ref(results.value)

// Update cached results smartly
watch([results, query], ([newResults, newQuery]) => {
  if (newResults) {
    cachedResults.value = newResults
    previousQuery.value = newQuery
  }
})

// Reference to the results list for scroll restoration
const resultsListRef = ref<HTMLOListElement>()

// Scroll to restored position once results are loaded
watch([results, status, () => needsScrollRestore.value], ([newResults, newStatus, shouldScroll]) => {
  if (shouldScroll && newStatus === 'success' && newResults && newResults.objects.length > 0) {
    needsScrollRestore.value = false
    // Scroll to the first item of the target page
    nextTick(() => {
      const targetItemIndex = (initialPage.value - 1) * pageSize
      const listItems = resultsListRef.value?.children
      if (listItems && listItems[targetItemIndex]) {
        listItems[targetItemIndex].scrollIntoView({
          behavior: 'instant',
          block: 'start',
        })
      }
    })
  }
})

// Determine if we should show previous results while loading
// (when new query is a continuation of the old one)
const isQueryContinuation = computed(() => {
  const current = query.value.toLowerCase()
  const previous = previousQuery.value.toLowerCase()
  return previous && current.startsWith(previous)
})

// Show cached results while loading if it's a continuation query
const visibleResults = computed(() => {
  if (status.value === 'pending' && isQueryContinuation.value && cachedResults.value) {
    return cachedResults.value
  }
  return results.value
})

// Should we show the loading spinner?
const showSearching = computed(() => {
  // Don't show during initial page load (view transition)
  if (!hasInteracted.value) return false
  // Don't show if we're displaying cached results
  if (status.value === 'pending' && isQueryContinuation.value && cachedResults.value) return false
  // Show if pending on first page
  return status.value === 'pending' && loadedPages.value === 1
})

const totalPages = computed(() => {
  if (!visibleResults.value) return 0
  return Math.ceil(visibleResults.value.total / pageSize)
})

const hasMore = computed(() => {
  return loadedPages.value < totalPages.value
})

// Load more when trigger becomes visible
function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  loadedPages.value++

  // Update URL with current page count for reload persistence
  router.replace({
    query: {
      ...route.query,
      page: loadedPages.value > 1 ? loadedPages.value : undefined,
    },
  })

  // Reset loading state after data updates
  nextTick(() => {
    isLoadingMore.value = false
  })
}

// Intersection observer for infinite scroll
onMounted(() => {
  if (!loadMoreTrigger.value) return

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && hasMore.value && status.value !== 'pending') {
        loadMore()
      }
    },
    { rootMargin: '200px' },
  )

  observer.observe(loadMoreTrigger.value)

  onUnmounted(() => observer.disconnect())
})

// Reset pages when query changes
watch(query, () => {
  loadedPages.value = 1
  hasInteracted.value = true
})

useSeoMeta({
  title: () => query.value ? `Search: ${query.value} - npmx` : 'Search Packages - npmx',
})

defineOgImageComponent('Default', {
  title: 'npmx',
  description: () => query.value ? `Search results for "${query.value}"` : 'Search npm packages',
})
</script>

<template>
  <main class="container py-8 sm:py-12 overflow-x-hidden">
    <header class="mb-8">
      <h1 class="font-mono text-2xl sm:text-3xl font-medium mb-6">
        search
      </h1>

      <search>
        <form
          role="search"
          class="relative"
          @submit.prevent
        >
          <label
            for="search-input"
            class="sr-only"
          >Search npm packages</label>

          <div
            class="relative group"
            :class="{ 'is-focused': isSearchFocused }"
          >
            <!-- Subtle glow effect -->
            <div
              class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
            />

            <div class="search-box relative flex items-center">
              <span class="absolute left-4 text-fg-subtle font-mono text-base pointer-events-none transition-colors duration-200 group-focus-within:text-fg-muted">
                /
              </span>
              <input
                id="search-input"
                ref="searchInputRef"
                v-model="inputValue"
                type="search"
                name="q"
                placeholder="search packages..."
                autocomplete="off"
                class="w-full max-w-full bg-bg-subtle border border-border rounded-lg pl-8 pr-4 py-3 font-mono text-base text-fg placeholder:text-fg-subtle transition-all duration-300 focus:(border-border-hover outline-none) appearance-none"
                @focus="isSearchFocused = true"
                @blur="isSearchFocused = false"
              >
              <!-- Hidden submit button for accessibility (form must have submit button per WCAG) -->
              <button
                type="submit"
                class="sr-only"
              >
                Search
              </button>
            </div>
          </div>
        </form>
      </search>
    </header>

    <section
      v-if="query"
      aria-label="Search results"
    >
      <!-- Initial loading (only after user interaction, not during view transition) -->
      <LoadingSpinner
        v-if="showSearching"
        text="Searching..."
      />

      <div v-else-if="visibleResults">
        <p
          v-if="visibleResults.total > 0"
          role="status"
          class="text-fg-muted text-sm mb-6 font-mono"
        >
          Found <span class="text-fg">{{ formatNumber(visibleResults.total) }}</span> packages
          <span
            v-if="status === 'pending'"
            class="text-fg-subtle"
          >(updating...)</span>
        </p>

        <p
          v-else
          role="status"
          class="text-fg-muted py-12 text-center font-mono"
        >
          No packages found for "<span class="text-fg">{{ query }}</span>"
        </p>

        <ol
          v-if="visibleResults.objects.length > 0"
          ref="resultsListRef"
          class="space-y-3 list-none m-0 p-0"
        >
          <li
            v-for="(result, index) in visibleResults.objects"
            :key="result.package.name"
            class="animate-fade-in animate-fill-both"
            :style="{ animationDelay: `${Math.min(index * 0.02, 0.3)}s` }"
          >
            <PackageCard
              :result="result"
              heading-level="h2"
              show-publisher
            />
          </li>
        </ol>

        <!-- Infinite scroll trigger -->
        <div
          ref="loadMoreTrigger"
          class="py-8 flex items-center justify-center"
        >
          <div
            v-if="isLoadingMore || (status === 'pending' && loadedPages > 1)"
            class="flex items-center gap-3 text-fg-muted font-mono text-sm"
          >
            <span class="w-4 h-4 border-2 border-fg-subtle border-t-fg rounded-full animate-spin" />
            Loading more...
          </div>
          <p
            v-else-if="!hasMore && visibleResults.objects.length > 0"
            class="text-fg-subtle font-mono text-sm"
          >
            End of results
          </p>
        </div>
      </div>
    </section>

    <section
      v-else
      class="py-20 text-center"
    >
      <p class="text-fg-subtle font-mono text-sm">
        Start typing to search packages
      </p>
    </section>
  </main>
</template>
