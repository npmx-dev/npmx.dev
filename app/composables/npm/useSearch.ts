import type {
  NpmSearchResponse,
  NpmSearchResult,
  SearchProvider,
  SearchResponse,
  SearchResult,
  SearchSuggestion,
} from '#shared/types'
import type { AlgoliaMultiSearchChecks } from './useAlgoliaSearch'
import { emptySearchResponse, parseSuggestionIntent } from './search-utils'
import { isValidNewPackageName, checkPackageExists } from '~/utils/package-name'

export const SEARCH_ENGINE_HITS_LIMIT: Record<SearchProvider, number> = {
  algolia: 1000,
  npm: 5000,
} as const

const DEFAULT_INITIAL_SEARCH_LIMIT = 25

export interface SearchOptions {
  size?: number
}

export interface UseSearchConfig {
  /**
   * Enable org/user suggestion and package-availability checks alongside search.
   * Algolia bundles these into the same multi-search request.
   * npm runs them as separate API calls in parallel.
   */
  suggestions?: boolean
}

interface SearchResponseCache {
  query: string
  provider: SearchProvider
  objects: NpmSearchResult[]
  totalUnlimited: number
  total: number
}

export function useSearch(
  query: MaybeRefOrGetter<string>,
  searchProvider: MaybeRefOrGetter<SearchProvider>,
  options: MaybeRefOrGetter<SearchOptions> = {},
  config: UseSearchConfig = {},
) {
  const { search: searchAlgolia, searchWithSuggestions: algoliaMultiSearch } = useAlgoliaSearch()
  const {
    search: searchNpm,
    checkOrgExists: checkOrgNpm,
    checkUserExists: checkUserNpm,
  } = useNpmSearch()

  const cache = shallowRef<SearchResponseCache | null>(null)

  const isLoadingMore = shallowRef(false)
  const isRateLimited = shallowRef(false)

  const suggestions = shallowRef<SearchSuggestion[]>([])
  const suggestionsLoading = shallowRef(false)
  const packageAvailability = shallowRef<{ name: string; available: boolean } | null>(null)
  const existenceCache = shallowRef<Record<string, boolean>>({})
  const suggestionRequestId = shallowRef(0)

  function setCache(objects: NpmSearchResult[] | null, total: number = 0): void {
    if (objects === null) {
      cache.value = null
      return
    }

    const provider = toValue(searchProvider)

    cache.value = {
      query: toValue(query),
      provider,
      objects,
      totalUnlimited: total,
      total: Math.min(total, SEARCH_ENGINE_HITS_LIMIT[provider]),
    }
  }

  function prepareSearchResponse(response: NpmSearchResponse | SearchResponse): SearchResponse {
    const totalUnlimited: number =
      'totalUnlimited' in response ? response.totalUnlimited : response.total

    return {
      ...response,
      totalUnlimited,
      total: Math.min(totalUnlimited, SEARCH_ENGINE_HITS_LIMIT[toValue(searchProvider)]),
    }
  }

  function emptySearchPayload(): SearchResult {
    return {
      searchResponse: emptySearchResponse(),
      suggestions: [],
      packageAvailability: null,
    }
  }

  /**
   * Determine which extra checks to include in the Algolia multi-search.
   * Returns `undefined` when nothing uncached needs checking.
   */
  function buildAlgoliaChecks(q: string): AlgoliaMultiSearchChecks | undefined {
    if (!config.suggestions) return undefined

    const { intent, name } = parseSuggestionIntent(q)
    const lowerName = name.toLowerCase()

    const checks: AlgoliaMultiSearchChecks = {}
    let hasChecks = false

    if (intent && name) {
      const wantOrg = intent === 'org' || intent === 'both'
      const wantUser = intent === 'user' || intent === 'both'

      if (wantOrg && existenceCache.value[`org:${lowerName}`] === undefined) {
        checks.name = name
        checks.checkOrg = true
        hasChecks = true
      }
      if (wantUser && existenceCache.value[`user:${lowerName}`] === undefined) {
        checks.name = name
        checks.checkUser = true
        hasChecks = true
      }
    }

    const trimmed = q.trim()
    if (isValidNewPackageName(trimmed)) {
      checks.checkPackage = trimmed
      hasChecks = true
    }

    return hasChecks ? checks : undefined
  }

  /**
   * Update suggestion and package-availability state from multi-search results.
   * Only writes to the cache for checks that were actually sent; reads from
   * existing cache for the rest.
   */
  function processAlgoliaChecks(
    q: string,
    checks: AlgoliaMultiSearchChecks | undefined,
    result: { orgExists: boolean; userExists: boolean; packageExists: boolean | null },
  ) {
    const { intent, name } = parseSuggestionIntent(q)

    if (intent && name) {
      const lowerName = name.toLowerCase()
      const wantOrg = intent === 'org' || intent === 'both'
      const wantUser = intent === 'user' || intent === 'both'

      const updates: Record<string, boolean> = {}
      if (checks?.checkOrg) updates[`org:${lowerName}`] = result.orgExists
      if (checks?.checkUser) updates[`user:${lowerName}`] = result.userExists
      if (Object.keys(updates).length > 0) {
        existenceCache.value = { ...existenceCache.value, ...updates }
      }

      // Prefer org over user when both match (orgs always match owner.name too)
      const isOrg = wantOrg && existenceCache.value[`org:${lowerName}`]
      const isUser = wantUser && existenceCache.value[`user:${lowerName}`]

      const newSuggestions: SearchSuggestion[] = []
      if (isOrg) {
        newSuggestions.push({ type: 'org', name: lowerName, exists: true })
      }
      if (isUser && !isOrg) {
        newSuggestions.push({ type: 'user', name: lowerName, exists: true })
      }
      suggestions.value = newSuggestions
    } else {
      suggestions.value = []
    }

    const trimmed = q.trim()
    if (result.packageExists !== null && isValidNewPackageName(trimmed)) {
      packageAvailability.value = { name: trimmed, available: !result.packageExists }
    } else if (!isValidNewPackageName(trimmed)) {
      packageAvailability.value = null
    }

    suggestionsLoading.value = false
  }

  const asyncData = useLazyAsyncData<SearchResult>(
    () => `search:${toValue(searchProvider)}:${toValue(query)}`,
    async (_nuxtApp, { signal }) => {
      const q = toValue(query)
      const provider = toValue(searchProvider)

      if (!q.trim()) {
        isRateLimited.value = false
        return emptySearchPayload()
      }

      const opts = toValue(options)
      setCache(null)

      if (provider === 'algolia') {
        const checks = config.suggestions ? buildAlgoliaChecks(q) : undefined

        if (config.suggestions) {
          suggestionsLoading.value = true
          const result = await algoliaMultiSearch(
            q,
            { size: opts.size ?? DEFAULT_INITIAL_SEARCH_LIMIT },
            checks,
          )

          if (q !== toValue(query)) {
            return emptySearchPayload()
          }

          isRateLimited.value = false
          processAlgoliaChecks(q, checks, result)
          return {
            searchResponse: prepareSearchResponse(result.search),
            suggestions: suggestions.value,
            packageAvailability: packageAvailability.value,
          }
        }

        const response = await searchAlgolia(q, { size: opts.size ?? DEFAULT_INITIAL_SEARCH_LIMIT })

        if (q !== toValue(query)) {
          return emptySearchPayload()
        }

        isRateLimited.value = false
        return {
          searchResponse: prepareSearchResponse(response),
          suggestions: [],
          packageAvailability: null,
        }
      }

      try {
        const response = await searchNpm(
          q,
          { size: opts.size ?? DEFAULT_INITIAL_SEARCH_LIMIT },
          signal,
        )

        if (q !== toValue(query)) {
          return emptySearchPayload()
        }

        setCache(response.objects, response.total)

        isRateLimited.value = false
        return {
          searchResponse: prepareSearchResponse(response),
          suggestions: [],
          packageAvailability: null,
        }
      } catch (error: unknown) {
        const errorMessage = (error as { message?: string })?.message || String(error)
        const isRateLimitError =
          errorMessage.includes('Failed to fetch') || errorMessage.includes('429')

        if (isRateLimitError) {
          isRateLimited.value = true
          return emptySearchPayload()
        }
        throw error
      }
    },
    { default: emptySearchPayload },
  )

  async function fetchMore(targetSize: number): Promise<void> {
    const q = toValue(query).trim()
    const provider = toValue(searchProvider)

    if (!q) {
      setCache(null)
      return
    }

    if (cache.value && (cache.value.query !== q || cache.value.provider !== provider)) {
      setCache(null)
      await asyncData.refresh()
      return
    }

    // Seed cache from asyncData for Algolia (which skips cache on initial fetch)
    if (!cache.value && asyncData.data.value) {
      const { searchResponse } = asyncData.data.value
      setCache([...searchResponse.objects], searchResponse.totalUnlimited)
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = cache.value?.total ?? Infinity

    if (currentCount >= targetSize || currentCount >= total) {
      return
    }

    isLoadingMore.value = true

    try {
      const from = currentCount
      const size = Math.min(targetSize - currentCount, total - currentCount)

      const doSearch = provider === 'algolia' ? searchAlgolia : searchNpm
      const response = await doSearch(q, { size, from })

      if (cache.value && cache.value.query === q && cache.value.provider === provider) {
        const existingNames = new Set(cache.value.objects.map(obj => obj.package.name))
        const newObjects = response.objects.filter(obj => !existingNames.has(obj.package.name))

        setCache([...cache.value.objects, ...newObjects], response.total)
      } else {
        setCache(response.objects, response.total)
      }

      if (
        cache.value &&
        cache.value.objects.length < targetSize &&
        cache.value.objects.length < cache.value.total &&
        cache.value.objects.length < SEARCH_ENGINE_HITS_LIMIT[provider] // additional protection from infinite loop
      ) {
        await fetchMore(targetSize)
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  watch(
    () => toValue(options).size,
    async (newSize, oldSize) => {
      if (!newSize) return
      if (oldSize && newSize > oldSize && toValue(query).trim()) {
        await fetchMore(newSize)
      }
    },
  )

  watch(
    () => toValue(searchProvider),
    async () => {
      setCache(null)
      existenceCache.value = {}
      await asyncData.refresh()
      const targetSize = toValue(options).size
      if (targetSize) {
        await fetchMore(targetSize)
      }
    },
  )

  const data = computed<SearchResponse | null>(() => {
    if (cache.value) {
      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.total,
        totalUnlimited: cache.value.totalUnlimited,
        time: new Date().toISOString(),
      }
    }
    return asyncData.data.value?.searchResponse ?? null
  })

  const hasMore = computed<boolean>(() => {
    if (!cache.value) return true
    return cache.value.objects.length < cache.value.total
  })

  async function validateSuggestionsNpm(q: string) {
    const requestId = ++suggestionRequestId.value
    const { intent, name } = parseSuggestionIntent(q)
    let availability: { name: string; available: boolean } | null = null

    const promises: Promise<void>[] = []

    const trimmed = q.trim()
    if (isValidNewPackageName(trimmed)) {
      promises.push(
        checkPackageExists(trimmed)
          .then(exists => {
            if (trimmed === toValue(query).trim()) {
              availability = { name: trimmed, available: !exists }
              packageAvailability.value = availability
            }
          })
          .catch(() => {
            availability = null
          }),
      )
    } else {
      availability = null
    }

    if (!intent || !name) {
      suggestionsLoading.value = false
      await Promise.all(promises)
      return { suggestions: [], packageAvailability: availability }
    }

    suggestionsLoading.value = true
    const result: SearchSuggestion[] = []
    const lowerName = name.toLowerCase()

    try {
      const wantOrg = intent === 'org' || intent === 'both'
      const wantUser = intent === 'user' || intent === 'both'

      if (wantOrg && existenceCache.value[`org:${lowerName}`] === undefined) {
        promises.push(
          checkOrgNpm(lowerName)
            .then(exists => {
              existenceCache.value = { ...existenceCache.value, [`org:${lowerName}`]: exists }
            })
            .catch(() => {
              existenceCache.value = { ...existenceCache.value, [`org:${lowerName}`]: false }
            }),
        )
      }

      if (wantUser && existenceCache.value[`user:${lowerName}`] === undefined) {
        promises.push(
          checkUserNpm(lowerName)
            .then(exists => {
              existenceCache.value = { ...existenceCache.value, [`user:${lowerName}`]: exists }
            })
            .catch(() => {
              existenceCache.value = { ...existenceCache.value, [`user:${lowerName}`]: false }
            }),
        )
      }

      if (promises.length > 0) {
        await Promise.all(promises)
      }

      if (requestId !== suggestionRequestId.value)
        return { suggestions: [], packageAvailability: availability }

      const isOrg = wantOrg && existenceCache.value[`org:${lowerName}`]
      const isUser = wantUser && existenceCache.value[`user:${lowerName}`]

      if (isOrg) {
        result.push({ type: 'org', name: lowerName, exists: true })
      }
      if (isUser && !isOrg) {
        result.push({ type: 'user', name: lowerName, exists: true })
      }
    } finally {
      if (requestId === suggestionRequestId.value) {
        suggestionsLoading.value = false
      }
    }

    if (requestId === suggestionRequestId.value) {
      suggestions.value = result
      return { suggestions: result, packageAvailability: availability }
    }

    return { suggestions: [], packageAvailability: availability }
  }

  const npmSuggestions = useLazyAsyncData(
    () => `npm-suggestions:${toValue(searchProvider)}:${toValue(query)}`,
    async () => {
      const q = toValue(query).trim()
      if (toValue(searchProvider) === 'algolia' || !q)
        return { suggestions: [], packageAvailability: null }
      const { intent, name } = parseSuggestionIntent(q)
      if (!intent || !name) return { suggestions: [], packageAvailability: null }
      return validateSuggestionsNpm(q)
    },
    { default: () => ({ suggestions: [], packageAvailability: null }) },
  )

  watch(
    [() => asyncData.data.value.suggestions, () => npmSuggestions.data.value.suggestions],
    ([algoliaSuggestions, npmSuggestionsValue]) => {
      if (algoliaSuggestions.length || npmSuggestionsValue.length) {
        suggestions.value = algoliaSuggestions.length ? algoliaSuggestions : npmSuggestionsValue
      }
    },
    { immediate: true },
  )

  watch(
    [
      () => asyncData.data.value?.packageAvailability,
      () => npmSuggestions.data.value.packageAvailability,
    ],
    ([algoliaPackageAvailability, npmPackageAvailability]) => {
      if (algoliaPackageAvailability || npmPackageAvailability) {
        packageAvailability.value = algoliaPackageAvailability || npmPackageAvailability
      }
    },
    { immediate: true },
  )

  if (import.meta.client && asyncData.data.value?.searchResponse.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return {
    ...asyncData,
    data,
    isLoadingMore,
    hasMore,
    fetchMore,
    isRateLimited: readonly(isRateLimited),
    suggestions: readonly(suggestions),
    suggestionsLoading: readonly(suggestionsLoading),
    packageAvailability: readonly(packageAvailability),
  }
}
