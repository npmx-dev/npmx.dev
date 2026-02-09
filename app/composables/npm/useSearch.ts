import type { NpmSearchResponse, NpmSearchResult } from '#shared/types'
import type { SearchProvider } from '~/composables/useSettings'
import type { AlgoliaMultiSearchChecks } from './useAlgoliaSearch'
import { type SearchSuggestion, emptySearchResponse, parseSuggestionIntent } from './search-utils'
import { isValidNewPackageName, checkPackageExists } from '~/utils/package-name'

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

export function useSearch(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<SearchOptions> = {},
  config: UseSearchConfig = {},
) {
  const { searchProvider } = useSearchProvider()
  const { search: searchAlgolia, searchWithSuggestions: algoliaMultiSearch } = useAlgoliaSearch()
  const {
    search: searchNpm,
    checkOrgExists: checkOrgNpm,
    checkUserExists: checkUserNpm,
  } = useNpmSearch()

  const cache = shallowRef<{
    query: string
    provider: SearchProvider
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)
  const isRateLimited = ref(false)

  const suggestions = shallowRef<SearchSuggestion[]>([])
  const suggestionsLoading = shallowRef(false)
  const packageAvailability = shallowRef<{ name: string; available: boolean } | null>(null)
  const existenceCache = shallowRef<Record<string, boolean>>({})
  let suggestionRequestId = 0

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
        newSuggestions.push({ type: 'org', name, exists: true })
      }
      if (isUser && !isOrg) {
        newSuggestions.push({ type: 'user', name, exists: true })
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

  const asyncData = useLazyAsyncData(
    () => `search:${searchProvider.value}:${toValue(query)}`,
    async (_nuxtApp, { signal }) => {
      const q = toValue(query)
      const provider = searchProvider.value

      if (!q.trim()) {
        isRateLimited.value = false
        return emptySearchResponse()
      }

      const opts = toValue(options)
      cache.value = null

      if (provider === 'algolia') {
        const checks = config.suggestions ? buildAlgoliaChecks(q) : undefined

        if (config.suggestions) {
          suggestionsLoading.value = true
          const result = await algoliaMultiSearch(q, { size: opts.size ?? 25 }, checks)

          if (q !== toValue(query)) {
            return emptySearchResponse()
          }

          isRateLimited.value = false
          processAlgoliaChecks(q, checks, result)
          return result.search
        }

        const response = await searchAlgolia(q, { size: opts.size ?? 25 })

        if (q !== toValue(query)) {
          return emptySearchResponse()
        }

        isRateLimited.value = false
        return response
      }

      try {
        const response = await searchNpm(q, { size: opts.size ?? 25 }, signal)

        if (q !== toValue(query)) {
          return emptySearchResponse()
        }

        cache.value = {
          query: q,
          provider,
          objects: response.objects,
          total: response.total,
        }

        isRateLimited.value = false
        return response
      } catch (error: unknown) {
        const errorMessage = (error as { message?: string })?.message || String(error)
        const isRateLimitError =
          errorMessage.includes('Failed to fetch') || errorMessage.includes('429')

        if (isRateLimitError) {
          isRateLimited.value = true
          return emptySearchResponse()
        }
        throw error
      }
    },
    { default: emptySearchResponse },
  )

  async function fetchMore(targetSize: number): Promise<void> {
    const q = toValue(query).trim()
    const provider = searchProvider.value

    if (!q) {
      cache.value = null
      return
    }

    if (cache.value && (cache.value.query !== q || cache.value.provider !== provider)) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    // Seed cache from asyncData for Algolia (which skips cache on initial fetch)
    if (!cache.value && asyncData.data.value) {
      const d = asyncData.data.value
      cache.value = {
        query: q,
        provider,
        objects: [...d.objects],
        total: d.total,
      }
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
        cache.value = {
          query: q,
          provider,
          objects: [...cache.value.objects, ...newObjects],
          total: response.total,
        }
      } else {
        cache.value = {
          query: q,
          provider,
          objects: response.objects,
          total: response.total,
        }
      }

      if (
        cache.value &&
        cache.value.objects.length < targetSize &&
        cache.value.objects.length < cache.value.total
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

  watch(searchProvider, async () => {
    cache.value = null
    existenceCache.value = {}
    await asyncData.refresh()
    const targetSize = toValue(options).size
    if (targetSize) {
      await fetchMore(targetSize)
    }
  })

  const data = computed<NpmSearchResponse | null>(() => {
    if (cache.value) {
      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.total,
        time: new Date().toISOString(),
      }
    }
    return asyncData.data.value
  })

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  const hasMore = computed(() => {
    if (!cache.value) return true
    return cache.value.objects.length < cache.value.total
  })

  // npm suggestion checking (Algolia handles suggestions inside the search handler above)
  if (config.suggestions) {
    async function validateSuggestionsNpm(q: string) {
      const requestId = ++suggestionRequestId
      const { intent, name } = parseSuggestionIntent(q)

      const trimmed = q.trim()
      if (isValidNewPackageName(trimmed)) {
        checkPackageExists(trimmed)
          .then(exists => {
            if (trimmed === toValue(query).trim()) {
              packageAvailability.value = { name: trimmed, available: !exists }
            }
          })
          .catch(() => {
            packageAvailability.value = null
          })
      } else {
        packageAvailability.value = null
      }

      if (!intent || !name) {
        suggestions.value = []
        suggestionsLoading.value = false
        return
      }

      suggestionsLoading.value = true
      const result: SearchSuggestion[] = []
      const lowerName = name.toLowerCase()

      try {
        const wantOrg = intent === 'org' || intent === 'both'
        const wantUser = intent === 'user' || intent === 'both'

        const promises: Promise<void>[] = []

        if (wantOrg && existenceCache.value[`org:${lowerName}`] === undefined) {
          promises.push(
            checkOrgNpm(name)
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
            checkUserNpm(name)
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

        if (requestId !== suggestionRequestId) return

        const isOrg = wantOrg && existenceCache.value[`org:${lowerName}`]
        const isUser = wantUser && existenceCache.value[`user:${lowerName}`]

        if (isOrg) {
          result.push({ type: 'org', name, exists: true })
        }
        if (isUser && !isOrg) {
          result.push({ type: 'user', name, exists: true })
        }
      } finally {
        if (requestId === suggestionRequestId) {
          suggestionsLoading.value = false
        }
      }

      if (requestId === suggestionRequestId) {
        suggestions.value = result
      }
    }

    watch(
      () => toValue(query),
      q => {
        if (searchProvider.value !== 'algolia') {
          validateSuggestionsNpm(q)
        }
      },
      { immediate: true },
    )

    watch(searchProvider, () => {
      if (searchProvider.value !== 'algolia') {
        validateSuggestionsNpm(toValue(query))
      }
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
