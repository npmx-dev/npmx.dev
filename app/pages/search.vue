<script setup lang="ts">
import { formatNumber } from '#imports'
import { debounce } from 'perfect-debounce'
import { isValidNewPackageName, checkPackageExists } from '~/utils/package-name'

const { t } = useI18n()
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

const selectedIndex = ref(0)
const packageListRef = useTemplateRef('packageListRef')

const resultCount = computed(() => visibleResults.value?.objects.length ?? 0)

function clampIndex(next: number) {
  if (resultCount.value <= 0) return 0
  return Math.max(0, Math.min(resultCount.value - 1, next))
}

function scrollToSelectedResult() {
  // Use virtualizer's scrollToIndex to ensure the item is rendered and visible
  packageListRef.value?.scrollToIndex(selectedIndex.value)
}

function focusSelectedResult() {
  // First ensure the item is rendered by scrolling to it
  scrollToSelectedResult()
  // Then focus it after a tick to allow rendering
  nextTick(() => {
    const el = document.querySelector<HTMLElement>(`[data-result-index="${selectedIndex.value}"]`)
    el?.focus()
  })
}

function handleResultsKeydown(e: KeyboardEvent) {
  if (resultCount.value <= 0) return

  const isFromInput = (e.target as HTMLElement).tagName === 'INPUT'

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = clampIndex(selectedIndex.value + 1)
    // Only move focus if already in results, not when typing in search input
    if (isFromInput) {
      scrollToSelectedResult()
    } else {
      focusSelectedResult()
    }
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = clampIndex(selectedIndex.value - 1)
    if (isFromInput) {
      scrollToSelectedResult()
    } else {
      focusSelectedResult()
    }
    return
  }

  if (e.key === 'Enter') {
    const el = document.querySelector<HTMLElement>(`[data-result-index="${selectedIndex.value}"]`)
    if (!el) return
    e.preventDefault()
    el.click()
  }
}

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

const ALGOLIA = true
// fetch all pages up to current
const { data: results, status } = useNpmSearch(ALGOLIA ? inputValue : query, () => ({
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

function handleSelect(index: number) {
  if (index < 0) return
  selectedIndex.value = clampIndex(index)
}

// Reset pages when query changes
watch(query, () => {
  loadedPages.value = 1
  hasInteracted.value = true
})

// Reset selection when query changes (new search)
watch(query, () => {
  selectedIndex.value = 0
})

// Check if current query could be a valid package name
const isValidPackageName = computed(() => isValidNewPackageName(query.value.trim()))

// Check if package name is available (doesn't exist on npm)
const packageAvailability = ref<{ name: string; available: boolean } | null>(null)

// Debounced check for package availability
const checkAvailability = debounce(async (name: string) => {
  if (!isValidNewPackageName(name)) {
    packageAvailability.value = null
    return
  }

  try {
    const exists = await checkPackageExists(name)
    // Only update if this is still the current query
    if (name === query.value.trim()) {
      packageAvailability.value = { name, available: !exists }
    }
  } catch {
    packageAvailability.value = null
  }
}, 300)

// Trigger availability check when query changes
watch(
  query,
  q => {
    const trimmed = q.trim()
    if (isValidNewPackageName(trimmed)) {
      checkAvailability(trimmed)
    } else {
      packageAvailability.value = null
    }
  },
  { immediate: true },
)

// Get connector state
const { isConnected, npmUser, listOrgUsers } = useConnector()

// Check if this is a scoped package and extract scope
const packageScope = computed(() => {
  const q = query.value.trim()
  if (!q.startsWith('@')) return null
  const match = q.match(/^@([^/]+)\//)
  return match ? match[1] : null
})

// Track org membership for scoped packages
const orgMembership = ref<Record<string, boolean>>({})

// Check org membership when scope changes
watch(
  [packageScope, isConnected, npmUser],
  async ([scope, connected, user]) => {
    if (!scope || !connected || !user) return
    // Skip if already checked
    if (scope in orgMembership.value) return

    try {
      const users = await listOrgUsers(scope)
      // Check if current user is in the org's user list
      if (users && user in users) {
        orgMembership.value[scope] = true
      } else {
        orgMembership.value[scope] = false
      }
    } catch {
      orgMembership.value[scope] = false
    }
  },
  { immediate: true },
)

// Check if user can publish to scope (either their username or an org they're a member of)
const canPublishToScope = computed(() => {
  const scope = packageScope.value
  if (!scope) return true // Unscoped package
  if (!npmUser.value) return false
  // Can publish if scope matches username
  if (scope.toLowerCase() === npmUser.value.toLowerCase()) return true
  // Can publish if user is a member of the org
  return orgMembership.value[scope] === true
})

// Show claim prompt when valid name, available, connected, and has permission
const showClaimPrompt = computed(() => {
  return (
    isConnected.value &&
    isValidPackageName.value &&
    packageAvailability.value?.available === true &&
    packageAvailability.value.name === query.value.trim() &&
    canPublishToScope.value &&
    status.value !== 'pending'
  )
})

// Modal state for claiming a package
const claimModalOpen = ref(false)

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
            <label for="search-input" class="sr-only">{{ t('search.label') }}</label>

            <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
              <!-- Subtle glow effect -->
              <div
                class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100 motion-reduce:transition-none"
              />

              <div class="search-box relative flex items-center">
                <span
                  class="absolute left-4 text-fg-subtle font-mono text-base pointer-events-none transition-colors duration-200 group-focus-within:text-fg-muted"
                  aria-hidden="true"
                >
                  /
                </span>
                <input
                  id="search-input"
                  ref="searchInputRef"
                  v-model="inputValue"
                  type="search"
                  name="q"
                  :placeholder="t('search.placeholder')"
                  autocapitalize="off"
                  autocomplete="off"
                  autocorrect="off"
                  spellcheck="false"
                  class="w-full max-w-full bg-bg-subtle border border-border rounded-lg pl-8 pr-10 py-3 font-mono text-base text-fg placeholder:text-fg-subtle transition-colors duration-300 focus:border-border-hover focus-visible:outline-none appearance-none"
                  @focus="isSearchFocused = true"
                  @blur="isSearchFocused = false"
                  @keydown="handleResultsKeydown"
                />
                <button
                  v-show="inputValue"
                  type="button"
                  class="absolute right-3 text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                  :aria-label="t('search.clear')"
                  @click="inputValue = ''"
                >
                  <span class="i-carbon-close-large block w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <!-- Hidden submit button for accessibility (form must have submit button per WCAG) -->
                <button type="submit" class="sr-only">
                  {{ t('search.button') }}
                </button>
              </div>
            </div>
          </form>
        </search>
      </div>
    </header>

    <!-- Results area with container padding -->
    <div class="container pt-20 pb-6">
      <section v-if="query" aria-label="Search results" @keydown="handleResultsKeydown">
        <!-- Initial loading (only after user interaction, not during view transition) -->
        <LoadingSpinner v-if="showSearching" :text="t('search.searching')" />

        <div v-else-if="visibleResults">
          <!-- Claim prompt - shown at top when valid name but no exact match -->
          <div
            v-if="showClaimPrompt && visibleResults.total > 0"
            class="mb-6 p-4 bg-bg-subtle border border-border rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
          >
            <div class="flex-1 min-w-0">
              <p class="font-mono text-sm text-fg">
                {{ t('search.not_taken', { name: query }) }}
              </p>
              <p class="text-xs text-fg-muted mt-0.5">
                {{ t('search.claim_prompt') }}
              </p>
            </div>
            <button
              type="button"
              class="shrink-0 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
              @click="claimModalOpen = true"
            >
              {{ t('search.claim_button', { name: query }) }}
            </button>
          </div>

          <p
            v-if="visibleResults.total > 0"
            role="status"
            class="text-fg-muted text-sm mb-6 font-mono flex flex-wrap items-center gap-x-2 gap-y-1"
          >
            <span>
              {{
                t('search.found_packages', {
                  count: formatNumber(visibleResults.total),
                })
              }}
              <span v-if="status === 'pending' && !ALGOLIA" class="text-fg-subtle">{{
                t('search.updating')
              }}</span>
            </span>
            <span v-if="ALGOLIA">
              <a
                href="https://www.algolia.com/developers"
                target="_blank"
                rel="noopener noreferrer"
                class="underline hover:text-fg text-xs align-middle ml-2"
              >
                {{ t('search.algolia_disclaimer') }}
              </a>
            </span>
          </p>

          <!-- No results found -->
          <div v-else-if="status !== 'pending'" role="status" class="py-12 text-center">
            <p class="text-fg-muted font-mono mb-6">
              {{ t('search.no_results', { query }) }}
            </p>

            <!-- Offer to claim the package name if it's valid -->
            <div v-if="showClaimPrompt" class="max-w-md mx-auto">
              <div class="p-4 bg-bg-subtle border border-border rounded-lg">
                <p class="text-sm text-fg-muted mb-3">
                  {{ t('search.want_to_claim') }}
                </p>
                <button
                  type="button"
                  class="px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                  @click="claimModalOpen = true"
                >
                  {{ t('search.claim_button', { name: query }) }}
                </button>
              </div>
            </div>
          </div>

          <PackageList
            v-if="visibleResults.objects.length > 0"
            ref="packageListRef"
            :results="visibleResults.objects"
            :selected-index="selectedIndex"
            heading-level="h2"
            show-publisher
            :has-more="hasMore"
            :is-loading="isLoadingMore || (status === 'pending' && loadedPages > 1)"
            :page-size="pageSize"
            :initial-page="initialPage"
            @load-more="loadMore"
            @page-change="handlePageChange"
            @select="handleSelect"
          />
        </div>
      </section>

      <section v-else class="py-20 text-center">
        <p class="text-fg-subtle font-mono text-sm">
          {{ t('search.start_typing') }}
        </p>
      </section>
    </div>

    <!-- Claim package modal -->
    <ClaimPackageModal v-model:open="claimModalOpen" :package-name="query" />
  </main>
</template>
