<script setup lang="ts">
import { formatNumber } from '#imports'
import type { FilterChip, SortOption } from '#shared/types/preferences'
import { debounce } from 'perfect-debounce'
import { isValidNewPackageName, checkPackageExists } from '~/utils/package-name'
import { isPlatformSpecificPackage } from '~/utils/platform-packages'

const route = useRoute()
const router = useRouter()

// Preferences (persisted to localStorage)
const {
  viewMode,
  paginationMode,
  pageSize: preferredPageSize,
  columns,
  toggleColumn,
  resetColumns,
} = usePackageListPreferences()

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
const searchInputRef = useTemplateRef('searchInputRef')
const { focused: isSearchFocused } = useFocus(searchInputRef)

const selectedIndex = ref(0)
const packageListRef = useTemplateRef('packageListRef')

// Track if page just loaded (for hiding "Searching..." during view transition)
const hasInteracted = ref(false)
onMounted(() => {
  // Focus search onMount
  isSearchFocused.value = true
  // Small delay to let view transition complete
  setTimeout(() => {
    hasInteracted.value = true
  }, 300)
})

// Infinite scroll / pagination state
const pageSize = 25
const currentPage = ref(1)

// Calculate how many results we need based on current page and preferred page size
const requestedSize = computed(() => {
  const numericPrefSize = preferredPageSize.value === 'all' ? 250 : preferredPageSize.value
  // Always fetch at least enough for the current page
  return Math.max(pageSize, currentPage.value * numericPrefSize)
})

// Get initial page from URL (for scroll restoration on reload)
const initialPage = computed(() => {
  const p = Number.parseInt(route.query.page as string, 10)
  return Number.isNaN(p) ? 1 : Math.max(1, p)
})

// Initialize current page from URL on mount
onMounted(() => {
  if (initialPage.value > 1) {
    currentPage.value = initialPage.value
  }
})

// Use incremental search with client-side caching
const {
  data: results,
  status,
  isLoadingMore,
  hasMore,
  fetchMore,
} = useNpmSearch(query, () => ({
  size: requestedSize.value,
  incremental: true,
}))

// Track previous query for UI continuity
const previousQuery = useState('search-previous-query', () => query.value)

// Update previous query when results change
watch(
  () => results.value,
  newResults => {
    if (newResults && newResults.objects.length > 0) {
      previousQuery.value = query.value
    }
  },
)

const resultsMatchQuery = computed(() => {
  return previousQuery.value === query.value
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

// Minimal structured filters usage for search context (no client-side filtering)
const {
  filters,
  sortOption,
  sortedPackages,
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
  setSort,
} = useStructuredFilters({
  packages: resultsArray,
  initialSort: 'relevance-desc', // Default to search relevance
})

// Client-side filtered/sorted results for display
// In search context, we always use server order (relevance) - no client-side filtering
const displayResults = computed(() => {
  // When using relevance sort, return original server-sorted results
  if (sortOption.value === 'relevance-desc' || sortOption.value === 'relevance-asc') {
    return resultsArray.value
  }

  return sortedPackages.value
})

const resultCount = computed(() => displayResults.value.length)

// Handle filter chip removal
function handleClearFilter(chip: FilterChip) {
  clearFilter(chip)
}

// Handle sort change from table
function handleSortChange(option: SortOption) {
  setSort(option)
}

// Should we show the loading spinner?
const showSearching = computed(() => {
  // Don't show during initial page load (view transition)
  if (!hasInteracted.value) return false
  // Show if pending and no results yet
  return status.value === 'pending' && displayResults.value.length === 0
})

const totalPages = computed(() => {
  if (!visibleResults.value) return 0
  return Math.ceil(visibleResults.value.total / pageSize)
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

/**
 * Check if a string is a valid npm username/org name
 * npm usernames: 1-214 characters, lowercase, alphanumeric, hyphen, underscore
 * Must not start with hyphen or underscore
 */
function isValidNpmName(name: string): boolean {
  if (!name || name.length === 0 || name.length > 214) return false
  // Must start with alphanumeric
  if (!/^[a-z0-9]/i.test(name)) return false
  // Can contain alphanumeric, hyphen, underscore
  return /^[a-z0-9_-]+$/i.test(name)
}

/** Validated user/org suggestion */
interface ValidatedSuggestion {
  type: 'user' | 'org'
  name: string
  exists: boolean
}

/** Cache for existence checks to avoid repeated API calls */
const existenceCache = ref<Record<string, boolean | 'pending'>>({})

const NPM_REGISTRY = 'https://registry.npmjs.org'

interface NpmSearchResponse {
  total: number
  objects: Array<{ package: { name: string } }>
}

/**
 * Check if an org exists by searching for packages with @orgname scope
 * Uses the search API which has CORS enabled
 */
async function checkOrgExists(name: string): Promise<boolean> {
  const cacheKey = `org:${name.toLowerCase()}`
  if (cacheKey in existenceCache.value) {
    const cached = existenceCache.value[cacheKey]
    return cached === true
  }
  existenceCache.value[cacheKey] = 'pending'
  try {
    // Search for packages in the @org scope
    const response = await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search`, {
      query: { text: `@${name}`, size: 5 },
    })
    // Verify at least one result actually starts with @orgname/
    const scopePrefix = `@${name.toLowerCase()}/`
    const exists = response.objects.some(obj =>
      obj.package.name.toLowerCase().startsWith(scopePrefix),
    )
    existenceCache.value[cacheKey] = exists
    return exists
  } catch {
    existenceCache.value[cacheKey] = false
    return false
  }
}

/**
 * Check if a user exists by searching for packages they maintain
 * Uses the search API which has CORS enabled
 */
async function checkUserExists(name: string): Promise<boolean> {
  const cacheKey = `user:${name.toLowerCase()}`
  if (cacheKey in existenceCache.value) {
    const cached = existenceCache.value[cacheKey]
    return cached === true
  }
  existenceCache.value[cacheKey] = 'pending'
  try {
    const response = await $fetch<{ total: number }>(`${NPM_REGISTRY}/-/v1/search`, {
      query: { text: `maintainer:${name}`, size: 1 },
    })
    const exists = response.total > 0
    existenceCache.value[cacheKey] = exists
    return exists
  } catch {
    existenceCache.value[cacheKey] = false
    return false
  }
}

/**
 * Parse the search query to extract potential user/org name
 */
interface ParsedQuery {
  type: 'user' | 'org' | 'both' | null
  name: string
}

const parsedQuery = computed<ParsedQuery>(() => {
  const q = query.value.trim()
  if (!q) return { type: null, name: '' }

  // Query starts with ~ - explicit user search
  if (q.startsWith('~')) {
    const name = q.slice(1)
    if (isValidNpmName(name)) {
      return { type: 'user', name }
    }
    return { type: null, name: '' }
  }

  // Query starts with @ - org search (without slash)
  if (q.startsWith('@')) {
    // If it contains a slash, it's a scoped package search
    if (q.includes('/')) return { type: null, name: '' }
    const name = q.slice(1)
    if (isValidNpmName(name)) {
      return { type: 'org', name }
    }
    return { type: null, name: '' }
  }

  // Plain query - could be user, org, or package
  if (isValidNpmName(q)) {
    return { type: 'both', name: q }
  }

  return { type: null, name: '' }
})

/** Validated suggestions (only those that exist) */
const validatedSuggestions = ref<ValidatedSuggestion[]>([])
const suggestionsLoading = ref(false)

/** Debounced function to validate suggestions */
const validateSuggestions = debounce(async (parsed: ParsedQuery) => {
  if (!parsed.type || !parsed.name) {
    validatedSuggestions.value = []
    return
  }

  suggestionsLoading.value = true
  const suggestions: ValidatedSuggestion[] = []

  try {
    if (parsed.type === 'user') {
      const exists = await checkUserExists(parsed.name)
      if (exists) {
        suggestions.push({ type: 'user', name: parsed.name, exists: true })
      }
    } else if (parsed.type === 'org') {
      const exists = await checkOrgExists(parsed.name)
      if (exists) {
        suggestions.push({ type: 'org', name: parsed.name, exists: true })
      }
    } else if (parsed.type === 'both') {
      // Check both in parallel
      const [orgExists, userExists] = await Promise.all([
        checkOrgExists(parsed.name),
        checkUserExists(parsed.name),
      ])
      // Org first (more common)
      if (orgExists) {
        suggestions.push({ type: 'org', name: parsed.name, exists: true })
      }
      if (userExists) {
        suggestions.push({ type: 'user', name: parsed.name, exists: true })
      }
    }
  } finally {
    suggestionsLoading.value = false
  }

  validatedSuggestions.value = suggestions
}, 200)

// Validate suggestions when query changes
watch(
  parsedQuery,
  parsed => {
    validateSuggestions(parsed)
  },
  { immediate: true },
)

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

/**
 * Selection uses negative indices for suggestions, positive for packages
 * -2 = first suggestion, -1 = second suggestion, 0+ = package indices
 */
const suggestionCount = computed(() => validatedSuggestions.value.length)
const totalSelectableCount = computed(() => suggestionCount.value + resultCount.value)

/** Unified selected index: negative for suggestions, 0+ for packages */
const unifiedSelectedIndex = ref(0)
const userHasNavigated = ref(false)

/** Convert unified index to suggestion index (0-based) or null */
function toSuggestionIndex(unified: number): number | null {
  if (unified < 0 && unified >= -suggestionCount.value) {
    return suggestionCount.value + unified
  }
  return null
}

/** Convert unified index to package index or null */
function toPackageIndex(unified: number): number | null {
  if (unified >= 0 && unified < resultCount.value) {
    return unified
  }
  return null
}

/** Clamp unified index to valid range */
function clampUnifiedIndex(next: number): number {
  const min = -suggestionCount.value
  const max = Math.max(0, resultCount.value - 1)
  if (totalSelectableCount.value <= 0) return 0
  return Math.max(min, Math.min(max, next))
}

// Keep legacy selectedIndex in sync for PackageList
watch(unifiedSelectedIndex, unified => {
  const pkgIndex = toPackageIndex(unified)
  selectedIndex.value = pkgIndex ?? -1
})

// Initialize selection to exact match when results load
watch(
  [visibleResults, validatedSuggestions, exactMatchType],
  () => {
    if (userHasNavigated.value) {
      unifiedSelectedIndex.value = clampUnifiedIndex(unifiedSelectedIndex.value)
      return
    }

    if (exactMatchType.value === 'package') {
      // Find the exact match package index
      const q = query.value.trim().toLowerCase()
      const idx =
        visibleResults.value?.objects.findIndex(r => r.package.name.toLowerCase() === q) ?? -1
      if (idx >= 0) {
        unifiedSelectedIndex.value = idx
        return
      }
    }
    if (exactMatchType.value === 'org') {
      // Select the org suggestion
      const orgIdx = validatedSuggestions.value.findIndex(s => s.type === 'org')
      if (orgIdx >= 0) {
        unifiedSelectedIndex.value = -(suggestionCount.value - orgIdx)
        return
      }
    }
    if (exactMatchType.value === 'user') {
      // Select the user suggestion
      const userIdx = validatedSuggestions.value.findIndex(s => s.type === 'user')
      if (userIdx >= 0) {
        unifiedSelectedIndex.value = -(suggestionCount.value - userIdx)
        return
      }
    }
    // Default to first item (first suggestion if any, else first package)
    unifiedSelectedIndex.value = suggestionCount.value > 0 ? -suggestionCount.value : 0
  },
  { immediate: true },
)

// Reset selection and navigation flag when query changes
watch(query, () => {
  userHasNavigated.value = false
  // Will be re-initialized by the watch above when results load
  unifiedSelectedIndex.value = 0
})

function scrollToSelectedItem() {
  const pkgIndex = toPackageIndex(unifiedSelectedIndex.value)
  if (pkgIndex !== null) {
    packageListRef.value?.scrollToIndex(pkgIndex)
  }
}

function focusSelectedItem() {
  const suggIdx = toSuggestionIndex(unifiedSelectedIndex.value)
  const pkgIdx = toPackageIndex(unifiedSelectedIndex.value)

  nextTick(() => {
    if (suggIdx !== null) {
      const el = document.querySelector<HTMLElement>(`[data-suggestion-index="${suggIdx}"]`)
      el?.focus()
    } else if (pkgIdx !== null) {
      scrollToSelectedItem()
      nextTick(() => {
        const el = document.querySelector<HTMLElement>(`[data-result-index="${pkgIdx}"]`)
        el?.focus()
      })
    }
  })
}

function handleResultsKeydown(e: KeyboardEvent) {
  if (totalSelectableCount.value <= 0) return

  const isFromInput = (e.target as HTMLElement).tagName === 'INPUT'

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    userHasNavigated.value = true
    unifiedSelectedIndex.value = clampUnifiedIndex(unifiedSelectedIndex.value + 1)
    if (isFromInput) {
      scrollToSelectedItem()
    } else {
      focusSelectedItem()
    }
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    userHasNavigated.value = true
    unifiedSelectedIndex.value = clampUnifiedIndex(unifiedSelectedIndex.value - 1)
    if (isFromInput) {
      scrollToSelectedItem()
    } else {
      focusSelectedItem()
    }
    return
  }

  if (e.key === 'Enter') {
    if (!resultsMatchQuery.value) return

    const suggIdx = toSuggestionIndex(unifiedSelectedIndex.value)
    const pkgIdx = toPackageIndex(unifiedSelectedIndex.value)

    if (suggIdx !== null) {
      const el = document.querySelector<HTMLElement>(`[data-suggestion-index="${suggIdx}"]`)
      if (el) {
        e.preventDefault()
        el.click()
      }
    } else if (pkgIdx !== null) {
      const el = document.querySelector<HTMLElement>(`[data-result-index="${pkgIdx}"]`)
      if (el) {
        e.preventDefault()
        el.click()
      }
    }
  }
}

function handleSuggestionSelect(index: number) {
  // Convert suggestion index to unified index
  unifiedSelectedIndex.value = -(suggestionCount.value - index)
}

function handlePackageSelect(index: number) {
  if (index < 0) return
  unifiedSelectedIndex.value = index
}

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
      <div class="container-sm py-4">
        <h1 class="font-mono text-xl sm:text-2xl font-medium mb-4">{{ $t('nav.search') }}</h1>

        <search>
          <form method="GET" action="/search" class="relative" @submit.prevent>
            <label for="search-input" class="sr-only">{{ $t('search.label') }}</label>

            <div class="relative group" :class="{ 'is-focused': isSearchFocused }">
              <!-- Subtle glow effect -->
              <div
                class="absolute -inset-px rounded-lg bg-gradient-to-r from-fg/0 via-fg/5 to-fg/0 opacity-0 transition-opacity duration-500 blur-sm group-[.is-focused]:opacity-100 motion-reduce:transition-none"
              />

              <div class="search-box relative flex items-center">
                <span
                  class="absolute left-4 text-fg-subtle font-mono text-base pointer-events-none transition-colors duration-200 group-focus-within:text-accent"
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
                  :placeholder="$t('search.placeholder')"
                  v-bind="noCorrect"
                  autofocus
                  class="w-full max-w-full bg-bg-subtle border border-border rounded-lg pl-8 pr-10 py-3 font-mono text-base text-fg placeholder:text-fg-subtle transition-colors duration-300 focus:border-accent focus-visible:outline-none appearance-none"
                  @keydown="handleResultsKeydown"
                />
                <button
                  v-show="inputValue"
                  type="button"
                  class="absolute right-3 p-2 text-fg-subtle hover:text-fg transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 rounded"
                  :aria-label="$t('search.clear')"
                  @click="inputValue = ''"
                >
                  <span class="i-carbon-close-large block w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <!-- Hidden submit button for accessibility (form must have submit button per WCAG) -->
                <button type="submit" class="sr-only">{{ $t('search.button') }}</button>
              </div>
            </div>
          </form>
        </search>
      </div>
    </header>

    <!-- Results area with container padding -->
    <div class="container-sm pt-20 pb-6">
      <section v-if="query" :aria-label="$t('search.results')" @keydown="handleResultsKeydown">
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
              :selected="toSuggestionIndex(unifiedSelectedIndex) === idx"
              :is-exact-match="
                (exactMatchType === 'org' && suggestion.type === 'org') ||
                (exactMatchType === 'user' && suggestion.type === 'user')
              "
              @focus="handleSuggestionSelect"
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
              class="shrink-0 px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md motion-safe:transition-colors motion-safe:duration-200 hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
              @click="claimModalOpen = true"
            >
              {{ $t('search.claim_button', { name: query }) }}
            </button>
          </div>

          <!-- Enhanced toolbar -->
          <div v-if="visibleResults.total > 0" class="mb-6">
            <PackageListToolbar
              :filters="filters"
              v-model:sort-option="sortOption"
              v-model:view-mode="viewMode"
              :columns="columns"
              v-model:pagination-mode="paginationMode"
              v-model:page-size="preferredPageSize"
              :total-count="visibleResults.total"
              :filtered-count="displayResults.length"
              :available-keywords="availableKeywords"
              :active-filters="activeFilters"
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
            <!-- Show "Found X packages" (infinite scroll mode only) -->
            <p
              v-if="viewMode === 'cards' && paginationMode === 'infinite'"
              role="status"
              class="text-fg-muted text-sm mt-4 font-mono"
            >
              {{ $t('search.found_packages', { count: formatNumber(visibleResults.total) }) }}
              <span v-if="status === 'pending'" class="text-fg-subtle">{{
                $t('search.updating')
              }}</span>
            </p>
            <!-- Show "x of y packages" (paginated/table mode only) -->
            <p
              v-if="viewMode === 'table' || paginationMode === 'paginated'"
              role="status"
              class="text-fg-muted text-sm mt-4 font-mono"
            >
              {{
                $t('filters.count.showing_paginated', {
                  pageSize: preferredPageSize === 'all' ? visibleResults.total : preferredPageSize,
                  total: visibleResults.total.toLocaleString(),
                })
              }}
            </p>
          </div>

          <!-- No results found -->
          <div v-else-if="status !== 'pending'" role="status" class="py-12">
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
                :selected="toSuggestionIndex(unifiedSelectedIndex) === idx"
                :is-exact-match="
                  (exactMatchType === 'org' && suggestion.type === 'org') ||
                  (exactMatchType === 'user' && suggestion.type === 'user')
                "
                @focus="handleSuggestionSelect"
              />
            </div>

            <!-- Offer to claim the package name if it's valid -->
            <div v-if="showClaimPrompt" class="max-w-md mx-auto text-center">
              <div class="p-4 bg-bg-subtle border border-border rounded-lg">
                <p class="text-sm text-fg-muted mb-3">{{ $t('search.want_to_claim') }}</p>
                <button
                  type="button"
                  class="px-4 py-2 font-mono text-sm text-bg bg-fg rounded-md transition-colors duration-200 hover:bg-fg/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
                  @click="claimModalOpen = true"
                >
                  {{ $t('search.claim_button', { name: query }) }}
                </button>
              </div>
            </div>
          </div>

          <PackageList
            v-if="displayResults.length > 0"
            ref="packageListRef"
            :results="displayResults"
            :selected-index="selectedIndex"
            :search-query="query"
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
            @select="handlePackageSelect"
            @click-keyword="toggleKeyword"
          />

          <!-- Pagination controls -->
          <PaginationControls
            v-if="displayResults.length > 0"
            v-model:mode="paginationMode"
            v-model:page-size="preferredPageSize"
            v-model:current-page="currentPage"
            :total-items="visibleResults?.total ?? displayResults.length"
            :view-mode="viewMode"
          />
        </div>
      </section>

      <section v-else class="py-20 text-center">
        <p class="text-fg-subtle font-mono text-sm">{{ $t('search.start_typing') }}</p>
      </section>
    </div>

    <!-- Claim package modal -->
    <ClaimPackageModal v-model:open="claimModalOpen" :package-name="query" />
  </main>
</template>
