<script setup lang="ts">
import type { FilterChip, SortKey } from '#shared/types/preferences'
import { parseSortOption, PROVIDER_SORT_KEYS } from '#shared/types/preferences'
import { onKeyDown } from '@vueuse/core'
import { debounce } from 'perfect-debounce'
import { isValidNewPackageName } from '~/utils/package-name'
import { isPlatformSpecificPackage } from '~/utils/platform-packages'
import { normalizeSearchParam } from '#shared/utils/url'

const route = useRoute()
const router = useRouter()

// Search provider
const { isAlgolia } = useSearchProvider()

// Preferences (persisted to localStorage)
const {
  viewMode,
  paginationMode,
  pageSize: preferredPageSize,
  columns,
  toggleColumn,
  resetColumns,
} = usePackageListPreferences()

// Debounced URL update for page (less aggressive to avoid too many URL changes)
const updateUrlPage = debounce((page: number) => {
  router.replace({
    query: {
      ...route.query,
      page: page > 1 ? page : undefined,
    },
  })
}, 500)

// The actual search query (from URL, used for API calls)
const query = computed(() => normalizeSearchParam(route.query.q))

// Track if page just loaded (for hiding "Searching..." during view transition)
const hasInteracted = shallowRef(false)
onMounted(() => {
  // Small delay to let view transition complete
  setTimeout(() => {
    hasInteracted.value = true
  }, 300)
})

// Infinite scroll / pagination state
const pageSize = 25
const currentPage = shallowRef(1)

// Get initial page from URL (for scroll restoration on reload)
const initialPage = computed(() => {
  const p = Number.parseInt(normalizeSearchParam(route.query.page), 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

// Initialize current page from URL on mount
onMounted(() => {
  if (initialPage.value > 1) {
    currentPage.value = initialPage.value
  }
})

// Results to display (directly from incremental search)
const rawVisibleResults = computed(() => results.value)

// Settings for platform package filtering
const { settings } = useSettings()

/**
 * Reorder results to put exact package name match at the top,
 * and optionally filter out platform-specific packages.
 */
const visibleResults = computed(() => {
  const raw = rawVisibleResults.value
  if (!raw) return raw

  let objects = raw.objects

  // Filter out platform-specific packages if setting is enabled
  if (settings.value.hidePlatformPackages) {
    objects = objects.filter(r => !isPlatformSpecificPackage(r.package.name))
  }

  const q = query.value.trim().toLowerCase()
  if (!q) {
    return objects === raw.objects ? raw : { ...raw, objects }
  }

  // Find exact match index
  const exactIdx = objects.findIndex(r => r.package.name.toLowerCase() === q)
  if (exactIdx <= 0) {
    return objects === raw.objects ? raw : { ...raw, objects }
  }

  // Move exact match to top
  const reordered = [...objects]
  const [exactMatch] = reordered.splice(exactIdx, 1)
  if (exactMatch) {
    reordered.unshift(exactMatch)
  }

  return {
    ...raw,
    objects: reordered,
  }
})

// Use structured filters for client-side refinement of search results
const resultsArray = computed(() => visibleResults.value?.objects ?? [])

// All possible non-relevance sort keys
const ALL_SORT_KEYS: SortKey[] = [
  'downloads-week',
  'downloads-day',
  'downloads-month',
  'downloads-year',
  'updated',
  'name',
  'quality',
  'popularity',
  'maintenance',
  'score',
]

// Disable sort keys the current provider can't meaningfully sort by
const disabledSortKeys = computed<SortKey[]>(() => {
  const supported = PROVIDER_SORT_KEYS[isAlgolia.value ? 'algolia' : 'npm']
  return ALL_SORT_KEYS.filter(k => !supported.has(k))
})

// Minimal structured filters usage for search context (no client-side filtering)
const {
  filters,
  sortOption,
  availableKeywords,
  activeFilters,
  setTextFilter,
  setSearchScope,
  setDownloadRange,
  setSecurity,
  setUpdatedWithin,
  toggleKeyword,
  clearFilter,
  clearAllFilters,
} = useStructuredFilters({
  packages: resultsArray,
  initialFilters: {
    ...parseSearchOperators(normalizeSearchParam(route.query.q)),
  },
  initialSort: 'relevance-desc', // Default to search relevance
})

const isRelevanceSort = computed(
  () => sortOption.value === 'relevance-desc' || sortOption.value === 'relevance-asc',
)

// Maximum eager-load sizes per provider for client-side sorting.
// Algolia supports up to 1000 with offset/length pagination.
// npm supports pagination via `from` parameter (no hard cap, but diminishing relevance).
const EAGER_LOAD_SIZE = { algolia: 500, npm: 500 } as const

// Calculate how many results we need based on current page and preferred page size
const requestedSize = computed(() => {
  const numericPrefSize = preferredPageSize.value === 'all' ? 250 : preferredPageSize.value
  const base = Math.max(pageSize, currentPage.value * numericPrefSize)
  // When sorting by something other than relevance, fetch a large batch
  // so client-side sorting operates on a meaningful pool of matching results
  if (!isRelevanceSort.value) {
    const cap = isAlgolia.value ? EAGER_LOAD_SIZE.algolia : EAGER_LOAD_SIZE.npm
    return Math.max(base, cap)
  }
  return base
})

// Reset to relevance sort when switching to a provider that doesn't support the current sort key
watch(isAlgolia, algolia => {
  const { key } = parseSortOption(sortOption.value)
  const supported = PROVIDER_SORT_KEYS[algolia ? 'algolia' : 'npm']
  if (!supported.has(key)) {
    sortOption.value = 'relevance-desc'
  }
})

// Use incremental search with client-side caching + org/user suggestions
const {
  data: results,
  status,
  isLoadingMore,
  hasMore,
  fetchMore,
  isRateLimited,
  suggestions: validatedSuggestions,
  packageAvailability,
} = useSearch(
  query,
  () => ({
    size: requestedSize.value,
  }),
  { suggestions: true },
)

// Client-side sorted results for display
// The search API already handles text filtering, so we only need to sort.
const displayResults = computed(() => {
  if (isRelevanceSort.value) {
    return resultsArray.value
  }

  // Sort the fetched results client-side — neither Algolia nor npm support
  // arbitrary sort orders server-side, so we fetch a large batch and sort here
  const { key, direction } = parseSortOption(sortOption.value)
  const multiplier = direction === 'asc' ? 1 : -1

  return [...resultsArray.value].sort((a, b) => {
    let diff: number
    switch (key) {
      case 'downloads-week':
      case 'downloads-day':
      case 'downloads-month':
      case 'downloads-year':
        diff = (a.downloads?.weekly ?? 0) - (b.downloads?.weekly ?? 0)
        break
      case 'updated':
        diff = new Date(a.package.date).getTime() - new Date(b.package.date).getTime()
        break
      case 'name':
        diff = a.package.name.localeCompare(b.package.name)
        break
      default:
        diff = 0
    }
    return diff * multiplier
  })
})

const resultCount = computed(() => displayResults.value.length)

/**
 * The effective total for display and pagination purposes.
 * When sorting by non-relevance, we're working with a fetched subset (e.g. 250),
 * not the full Algolia total (e.g. 92,324). Show the actual working set size.
 */
const effectiveTotal = computed(() => {
  if (isRelevanceSort.value) {
    return visibleResults.value?.total ?? 0
  }
  // When sorting, the total is the number of results we actually fetched and sorted
  return displayResults.value.length
})

// Handle filter chip removal
function handleClearFilter(chip: FilterChip) {
  clearFilter(chip)
}

// Should we show the loading spinner?
const showSearching = computed(() => {
  // Don't show during initial page load (view transition)
  if (!hasInteracted.value) return false
  // Show if pending and no results yet
  return status.value === 'pending' && displayResults.value.length === 0
})

// Load more when triggered by infinite scroll
async function loadMore() {
  if (isLoadingMore.value || !hasMore.value) return
  // Increase requested size to trigger fetch
  currentPage.value++
  await fetchMore(requestedSize.value)
}

// Update URL when page changes from scrolling
function handlePageChange(page: number) {
  updateUrlPage(page)
}

// Reset page when query changes
watch(query, () => {
  currentPage.value = 1
  hasInteracted.value = true
})

// Check if current query could be a valid package name
const isValidPackageName = computed(() => isValidNewPackageName(query.value.trim()))

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

const claimPackageModalRef = useTemplateRef('claimPackageModalRef')

/** Check if there's an exact package match in results */
const hasExactPackageMatch = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q || !visibleResults.value) return false
  return visibleResults.value.objects.some(r => r.package.name.toLowerCase() === q)
})

/** Check if query is an exact org match (e.g., @nuxt matches org nuxt) */
const isExactOrgQuery = computed(() => {
  const q = query.value.trim()
  if (!q.startsWith('@') || q.includes('/')) return false
  const orgName = q.slice(1).toLowerCase()
  return validatedSuggestions.value.some(
    s => s.type === 'org' && s.name.toLowerCase() === orgName && s.exists,
  )
})

/** Determine which item should be highlighted as exact match */
const exactMatchType = computed<'package' | 'org' | 'user' | null>(() => {
  // Package match takes priority
  if (hasExactPackageMatch.value) return 'package'
  // Then org match for @org queries
  if (isExactOrgQuery.value) return 'org'
  // Could extend to user matches for ~user queries
  const q = query.value.trim()
  if (q.startsWith('~')) {
    const userName = q.slice(1).toLowerCase()
    if (
      validatedSuggestions.value.some(
        s => s.type === 'user' && s.name.toLowerCase() === userName && s.exists,
      )
    ) {
      return 'user'
    }
  }
  return null
})

const suggestionCount = computed(() => validatedSuggestions.value.length)
const totalSelectableCount = computed(() => suggestionCount.value + resultCount.value)

/**
 * Get all focusable result elements in DOM order (suggestions first, then packages)
 */
function getFocusableElements(): HTMLElement[] {
  const suggestions = Array.from(
    document.querySelectorAll<HTMLElement>('[data-suggestion-index]'),
  ).sort((a, b) => {
    const aIdx = Number.parseInt(a.dataset.suggestionIndex ?? '0', 10)
    const bIdx = Number.parseInt(b.dataset.suggestionIndex ?? '0', 10)
    return aIdx - bIdx
  })
  const packages = Array.from(document.querySelectorAll<HTMLElement>('[data-result-index]')).sort(
    (a, b) => {
      const aIdx = Number.parseInt(a.dataset.resultIndex ?? '0', 10)
      const bIdx = Number.parseInt(b.dataset.resultIndex ?? '0', 10)
      return aIdx - bIdx
    },
  )
  return [...suggestions, ...packages]
}

/**
 * Focus an element and scroll it into view
 */
function focusElement(el: HTMLElement) {
  el.focus()
  el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// Navigate to package page
async function navigateToPackage(packageName: string) {
  await navigateTo(packageRoute(packageName))
}

// Track the input value when user pressed Enter (for navigating when results arrive)
const pendingEnterQuery = shallowRef<string | null>(null)

// Watch for results to navigate when Enter was pressed before results arrived
watch(displayResults, results => {
  if (!pendingEnterQuery.value) return

  // Check if input is still focused (user hasn't started navigating or clicked elsewhere)
  if (document.activeElement?.tagName !== 'INPUT') {
    pendingEnterQuery.value = null
    return
  }

  // Navigate if first result matches the query that was entered
  const firstResult = results[0]
  // eslint-disable-next-line no-console
  console.log('[search] watcher fired', {
    pending: pendingEnterQuery.value,
    firstResult: firstResult?.package.name,
  })
  if (firstResult?.package.name === pendingEnterQuery.value) {
    pendingEnterQuery.value = null
    navigateToPackage(firstResult.package.name)
  }
})

function handleResultsKeydown(e: KeyboardEvent) {
  // If the active element is an input, navigate to exact match or wait for results
  if (e.key === 'Enter' && document.activeElement?.tagName === 'INPUT') {
    // Get value directly from input (not from route query, which may be debounced)
    const inputValue = (document.activeElement as HTMLInputElement).value.trim()
    if (!inputValue) return

    // Check if first result matches the input value exactly
    const firstResult = displayResults.value[0]
    if (firstResult?.package.name === inputValue) {
      pendingEnterQuery.value = null
      return navigateToPackage(firstResult.package.name)
    }

    // No match yet - store input value, watcher will handle navigation when results arrive
    pendingEnterQuery.value = inputValue
    return
  }

  if (totalSelectableCount.value <= 0) return

  const elements = getFocusableElements()
  if (elements.length === 0) return

  const currentIndex = elements.findIndex(el => el === document.activeElement)

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const nextIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, elements.length - 1)
    const el = elements[nextIndex]
    if (el) focusElement(el)
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const nextIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0)
    const el = elements[nextIndex]
    if (el) focusElement(el)
    return
  }

  if (e.key === 'Enter') {
    // Browser handles Enter on focused links naturally, but handle for non-link elements
    if (document.activeElement && elements.includes(document.activeElement as HTMLElement)) {
      const el = document.activeElement as HTMLElement
      // Only prevent default and click if it's not already a link (links handle Enter natively)
      if (el.tagName !== 'A') {
        e.preventDefault()
        el.click()
      }
    }
  }
}

onKeyDown(['ArrowDown', 'ArrowUp', 'Enter'], handleResultsKeydown)

useSeoMeta({
  title: () =>
    `${query.value ? $t('search.title_search', { search: query.value }) : $t('search.title_packages')} - npmx`,
  ogTitle: () =>
    `${query.value ? $t('search.title_search', { search: query.value }) : $t('search.title_packages')} - npmx`,
  twitterTitle: () =>
    `${query.value ? $t('search.title_search', { search: query.value }) : $t('search.title_packages')} - npmx`,
  description: () =>
    query.value
      ? $t('search.meta_description', { search: query.value })
      : $t('search.meta_description_packages'),
  ogDescription: () =>
    query.value
      ? $t('search.meta_description', { search: query.value })
      : $t('search.meta_description_packages'),
  twitterDescription: () =>
    query.value
      ? $t('search.meta_description', { search: query.value })
      : $t('search.meta_description_packages'),
})

defineOgImageComponent('Default', {
  title: () =>
    `${query.value ? $t('search.title_search', { search: query.value }) : $t('search.title_packages')} - npmx`,
  description: () =>
    query.value
      ? $t('search.meta_description', { search: query.value })
      : $t('search.meta_description_packages'),
  primaryColor: '#60a5fa',
})
</script>

<template>
  <main class="flex-1 py-8" :class="{ 'overflow-x-hidden': viewMode !== 'table' }">
    <div class="container-sm">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h1 class="font-mono text-2xl sm:text-3xl font-medium">
          {{ $t('search.title') }}
        </h1>
        <SearchProviderToggle />
      </div>

      <section v-if="query">
        <!-- Initial loading (only after user interaction, not during view transition) -->
        <LoadingSpinner v-if="showSearching" :text="$t('search.searching')" />

        <div v-else-if="visibleResults">
          <!-- User/Org search suggestions -->
          <div v-if="validatedSuggestions.length > 0" class="mb-6 space-y-3">
            <SearchSuggestionCard
              v-for="(suggestion, idx) in validatedSuggestions"
              :key="`${suggestion.type}-${suggestion.name}`"
              :type="suggestion.type"
              :name="suggestion.name"
              :index="idx"
              :is-exact-match="
                (exactMatchType === 'org' && suggestion.type === 'org') ||
                (exactMatchType === 'user' && suggestion.type === 'user')
              "
            />
          </div>

          <!-- Claim prompt - shown at top when valid name but no exact match -->
          <div
            v-if="showClaimPrompt && visibleResults.total > 0"
            class="mb-6 p-4 bg-bg-subtle border border-border rounded-lg flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
          >
            <div class="flex-1 min-w-0">
              <p class="font-mono text-sm text-fg">
                {{ $t('search.not_taken', { name: query }) }}
              </p>
              <p class="text-xs text-fg-muted mt-0.5">{{ $t('search.claim_prompt') }}</p>
            </div>
            <button
              type="button"
              class="shrink-0 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md motion-safe:transition-colors motion-safe:duration-200 hover:bg-fg/90 focus-visible:outline-accent/70"
              @click="claimPackageModalRef?.open()"
            >
              {{ $t('search.claim_button', { name: query }) }}
            </button>
          </div>

          <!-- Rate limited by npm - check FIRST before showing any results -->
          <div v-if="isRateLimited" role="status" class="py-12">
            <p class="text-fg-muted font-mono mb-6 text-center">
              {{ $t('search.rate_limited') }}
            </p>
          </div>

          <!-- Enhanced toolbar -->
          <div v-else-if="visibleResults.total > 0" class="mb-6">
            <PackageListToolbar
              :filters="filters"
              v-model:sort-option="sortOption"
              v-model:view-mode="viewMode"
              :columns="columns"
              v-model:pagination-mode="paginationMode"
              v-model:page-size="preferredPageSize"
              :total-count="effectiveTotal"
              :filtered-count="displayResults.length"
              :available-keywords="availableKeywords"
              :active-filters="activeFilters"
              :disabled-sort-keys="disabledSortKeys"
              search-context
              @toggle-column="toggleColumn"
              @reset-columns="resetColumns"
              @clear-filter="handleClearFilter"
              @clear-all-filters="clearAllFilters"
              @update:text="setTextFilter"
              @update:search-scope="setSearchScope"
              @update:download-range="setDownloadRange"
              @update:security="setSecurity"
              @update:updated-within="setUpdatedWithin"
              @toggle-keyword="toggleKeyword"
            />
            <!-- Show count status (infinite scroll mode only) -->
            <p
              v-if="viewMode === 'cards' && paginationMode === 'infinite'"
              role="status"
              class="text-fg-muted text-sm mt-4 font-mono"
            >
              <template v-if="isRelevanceSort">
                {{
                  $t(
                    'search.found_packages',
                    { count: $n(visibleResults.total) },
                    visibleResults.total,
                  )
                }}
              </template>
              <template v-else>
                {{
                  $t('search.found_packages_sorted', { count: $n(effectiveTotal) }, effectiveTotal)
                }}
              </template>
              <span v-if="status === 'pending'" class="text-fg-subtle">{{
                $t('search.updating')
              }}</span>
            </p>
            <!-- Show "x of y" (paginated/table mode only) -->
            <p
              v-if="viewMode === 'table' || paginationMode === 'paginated'"
              role="status"
              class="text-fg-muted text-sm mt-4 font-mono"
            >
              {{
                $t(
                  'filters.count.showing_paginated',
                  {
                    pageSize: preferredPageSize === 'all' ? $n(effectiveTotal) : preferredPageSize,
                    count: $n(effectiveTotal),
                  },
                  effectiveTotal,
                )
              }}
            </p>
          </div>

          <!-- No results found -->
          <div v-else-if="status === 'success' || status === 'error'" role="status" class="py-12">
            <p class="text-fg-muted font-mono mb-6 text-center">
              {{ $t('search.no_results', { query }) }}
            </p>

            <!-- User/Org suggestions when no packages found -->
            <div v-if="validatedSuggestions.length > 0" class="max-w-md mx-auto mb-6 space-y-3">
              <SearchSuggestionCard
                v-for="(suggestion, idx) in validatedSuggestions"
                :key="`${suggestion.type}-${suggestion.name}`"
                :type="suggestion.type"
                :name="suggestion.name"
                :index="idx"
                :is-exact-match="
                  (exactMatchType === 'org' && suggestion.type === 'org') ||
                  (exactMatchType === 'user' && suggestion.type === 'user')
                "
              />
            </div>

            <!-- Offer to claim the package name if it's valid -->
            <div v-if="showClaimPrompt" class="max-w-md mx-auto text-center">
              <div class="p-4 bg-bg-subtle border border-border rounded-lg">
                <p class="text-sm text-fg-muted mb-3">{{ $t('search.want_to_claim') }}</p>
                <button
                  type="button"
                  class="px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 focus-visible:outline-accent/70"
                  @click="claimPackageModalRef?.open()"
                >
                  {{ $t('search.claim_button', { name: query }) }}
                </button>
              </div>
            </div>
          </div>

          <PackageList
            v-if="displayResults.length > 0 && !isRateLimited"
            :results="displayResults"
            :search-query="query"
            :filters="filters"
            search-context
            heading-level="h2"
            show-publisher
            :has-more="hasMore"
            :is-loading="isLoadingMore"
            :page-size="preferredPageSize"
            :initial-page="initialPage"
            :view-mode="viewMode"
            :columns="columns"
            v-model:sort-option="sortOption"
            :pagination-mode="paginationMode"
            :current-page="currentPage"
            @load-more="loadMore"
            @page-change="handlePageChange"
            @click-keyword="toggleKeyword"
          />

          <!-- Pagination controls -->
          <PaginationControls
            v-if="displayResults.length > 0 && !isRateLimited"
            v-model:mode="paginationMode"
            v-model:page-size="preferredPageSize"
            v-model:current-page="currentPage"
            :total-items="effectiveTotal"
            :view-mode="viewMode"
          />
        </div>
      </section>

      <section v-else class="py-20 text-center">
        <p class="text-fg-subtle font-mono text-sm">{{ $t('search.start_typing') }}</p>
      </section>
    </div>

    <!-- Claim package modal -->
    <PackageClaimPackageModal ref="claimPackageModalRef" :package-name="query" />
  </main>
</template>
