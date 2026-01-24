<script setup lang="ts">
import { formatNumber } from '#imports'
import { debounce } from 'perfect-debounce'

const route = useRoute()
const router = useRouter()

// Local input value (updates immediately as user types)
const inputValue = ref((route.query.q as string) ?? '')

// Debounced URL update for search query
const updateUrlQuery = debounce((value: string) => {
  router.replace({ query: { q: value || undefined } })
}, 250)

// Debounced URL update for page (less aggressive to avoid too many URL changes)
const updateUrlPage = debounce((page: number) => {
  router.replace({
    query: {
      ...route.query,
      page: page > 1 ? page : undefined,
    },
  })
}, 500)

// Watch input and debounce URL updates
watch(inputValue, value => {
  updateUrlQuery(value)
})

// The actual search query (from URL, used for API calls)
const query = computed(() => (route.query.q as string) ?? '')

// Sync input with URL when navigating (e.g., back button)
watch(
  () => route.query.q,
  urlQuery => {
    const value = (urlQuery as string) ?? ''
    if (inputValue.value !== value) {
      inputValue.value = value
    }
  },
)

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

// Get initial page from URL (for scroll restoration on reload)
const initialPage = computed(() => {
  const p = Number.parseInt(route.query.page as string, 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

// Initialize loaded pages from URL on mount
onMounted(() => {
  if (initialPage.value > 1) {
    // Load enough pages to show the initial page
    loadedPages.value = initialPage.value
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

// Load more when triggered by infinite scroll
function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return

  isLoadingMore.value = true
  loadedPages.value++

  // Reset loading state after data updates
  nextTick(() => {
    isLoadingMore.value = false
  })
}

// Update URL when page changes from scrolling
function handlePageChange(page: number) {
  updateUrlPage(page)
}

// Reset pages when query changes
watch(query, () => {
  loadedPages.value = 1
  hasInteracted.value = true
})

useSeoMeta({
  title: () => (query.value ? `Search: ${query.value} - npmx` : 'Search Packages - npmx'),
})

defineOgImageComponent('Default', {
  title: 'npmx',
  description: () => (query.value ? `Search results for "${query.value}"` : 'Search npm packages'),
})
</script>

<template>
  <main class="overflow-x-hidden">
    <!-- Sticky search header - positioned below AppHeader (h-14 = 56px) -->
    <header class="sticky top-14 z-40 bg-bg/95 backdrop-blur-sm border-b border-border">
      <div class="container py-4">
        <h1 class="font-mono text-xl sm:text-2xl font-medium mb-4">search</h1>

        <search>
          <form role="search" class="relative" @submit.prevent>
            <label for="search-input" class="sr-only">Search npm packages</label>

            <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
              <!-- Subtle glow effect -->
              <div
                class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100"
              />

              <div class="search-box relative flex items-center">
                <span
                  class="absolute left-4 text-fg-subtle font-mono text-base pointer-events-none transition-colors duration-200 group-focus-within:text-fg-muted"
                >
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
                />
                <!-- Hidden submit button for accessibility (form must have submit button per WCAG) -->
                <button type="submit" class="sr-only">Search</button>
              </div>
            </div>
          </form>
        </search>
      </div>
    </header>

    <!-- Results area with container padding -->
    <div class="container py-6">
      <section v-if="query" aria-label="Search results">
        <!-- Initial loading (only after user interaction, not during view transition) -->
        <LoadingSpinner v-if="showSearching" text="Searching..." />

        <div v-else-if="visibleResults">
          <p
            v-if="visibleResults.total > 0"
            role="status"
            class="text-fg-muted text-sm mb-6 font-mono"
          >
            Found <span class="text-fg">{{ formatNumber(visibleResults.total) }}</span> packages
            <span v-if="status === 'pending'" class="text-fg-subtle">(updating...)</span>
          </p>

          <p
            v-else-if="status !== 'pending'"
            role="status"
            class="text-fg-muted py-12 text-center font-mono"
          >
            No packages found for "<span class="text-fg">{{ query }}</span
            >"
          </p>

          <PackageList
            v-if="visibleResults.objects.length > 0"
            :results="visibleResults.objects"
            heading-level="h2"
            show-publisher
            :has-more="hasMore"
            :is-loading="isLoadingMore || (status === 'pending' && loadedPages > 1)"
            :page-size="pageSize"
            :initial-page="initialPage"
            @load-more="loadMore"
            @page-change="handlePageChange"
          />
        </div>
      </section>

      <section v-else class="py-20 text-center">
        <p class="text-fg-subtle font-mono text-sm">Start typing to search packages</p>
      </section>
    </div>
  </main>
</template>
