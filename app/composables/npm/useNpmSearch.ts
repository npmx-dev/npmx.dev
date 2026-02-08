import type {
  Packument,
  NpmSearchResponse,
  NpmSearchResult,
  NpmDownloadCount,
  MinimalPackument,
} from '#shared/types'
import type { SearchProvider } from '~/composables/useSettings'

/**
 * Convert packument to search result format for display
 */
export function packumentToSearchResult(
  pkg: MinimalPackument,
  weeklyDownloads?: number,
): NpmSearchResult {
  let latestVersion = ''
  if (pkg['dist-tags']) {
    latestVersion = pkg['dist-tags'].latest || Object.values(pkg['dist-tags'])[0] || ''
  }
  const modified = pkg.time.modified || pkg.time[latestVersion] || ''

  return {
    package: {
      name: pkg.name,
      version: latestVersion,
      description: pkg.description,
      keywords: pkg.keywords,
      date: pkg.time[latestVersion] || modified,
      links: {
        npm: `https://www.npmjs.com/package/${pkg.name}`,
      },
      maintainers: pkg.maintainers,
    },
    score: { final: 0, detail: { quality: 0, popularity: 0, maintenance: 0 } },
    searchScore: 0,
    downloads: weeklyDownloads !== undefined ? { weekly: weeklyDownloads } : undefined,
    updated: pkg.time[latestVersion] || modified,
  }
}

export interface NpmSearchOptions {
  /** Number of results to fetch */
  size?: number
}

export const emptySearchResponse = {
  objects: [],
  total: 0,
  isStale: false,
  time: new Date().toISOString(),
} satisfies NpmSearchResponse

export function useNpmSearch(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<NpmSearchOptions> = {},
) {
  const { $npmRegistry } = useNuxtApp()
  const { searchProvider } = useSearchProvider()
  const { search: searchAlgolia } = useAlgoliaSearch()

  // Client-side cache
  const cache = shallowRef<{
    query: string
    provider: SearchProvider
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  // Track rate limit errors separately for better UX
  // Using ref instead of shallowRef to ensure reactivity triggers properly
  const isRateLimited = ref(false)

  // Standard (non-incremental) search implementation
  let lastSearch: NpmSearchResponse | undefined = undefined

  const asyncData = useLazyAsyncData(
    () => `search:${searchProvider.value}:${toValue(query)}`,
    async ({ $npmRegistry, $npmApi }, { signal }) => {
      const q = toValue(query)
      const provider = searchProvider.value

      if (!q.trim()) {
        isRateLimited.value = false
        return emptySearchResponse
      }

      const opts = toValue(options)

      // This only runs for initial load or query changes
      // Reset cache for new query (but don't reset rate limit yet - only on success)
      cache.value = null

      // --- Algolia path (client-side only) ---
      if (provider === 'algolia') {
        const response = await searchAlgolia(q, {
          size: opts.size ?? 25,
        })

        if (q !== toValue(query)) {
          return emptySearchResponse
        }

        isRateLimited.value = false

        cache.value = {
          query: q,
          provider,
          objects: response.objects,
          total: response.total,
        }

        return response
      }

      // --- npm registry path ---
      const params = new URLSearchParams()
      params.set('text', q)
      params.set('size', String(opts.size ?? 25))

      try {
        if (q.length === 1) {
          const encodedName = encodePackageName(q)
          const [{ data: pkg, isStale }, { data: downloads }] = await Promise.all([
            $npmRegistry<Packument>(`/${encodedName}`, { signal }),
            $npmApi<NpmDownloadCount>(`/downloads/point/last-week/${encodedName}`, {
              signal,
            }),
          ])

          if (!pkg) {
            return emptySearchResponse
          }

          const result = packumentToSearchResult(pkg, downloads?.downloads)

          // If query changed/outdated, return empty search response
          if (q !== toValue(query)) {
            return emptySearchResponse
          }

          cache.value = {
            query: q,
            provider,
            objects: [result],
            total: 1,
          }

          // Success - clear rate limit flag
          isRateLimited.value = false

          return {
            objects: [result],
            total: 1,
            isStale,
            time: new Date().toISOString(),
          }
        }

        const { data: response, isStale } = await $npmRegistry<NpmSearchResponse>(
          `/-/v1/search?${params.toString()}`,
          { signal },
          60,
        )

        // If query changed/outdated, return empty search response
        if (q !== toValue(query)) {
          return emptySearchResponse
        }

        cache.value = {
          query: q,
          provider,
          objects: response.objects,
          total: response.total,
        }

        // Success - clear rate limit flag
        isRateLimited.value = false

        return { ...response, isStale }
      } catch (error: unknown) {
        // Detect rate limit errors. npm's 429 response doesn't include CORS headers,
        // so the browser reports "Failed to fetch" instead of the actual status code.
        const errorMessage = (error as { message?: string })?.message || String(error)
        const isRateLimitError =
          errorMessage.includes('Failed to fetch') || errorMessage.includes('429')

        if (isRateLimitError) {
          isRateLimited.value = true
          return emptySearchResponse
        }
        throw error
      }
    },
    { default: () => lastSearch || emptySearchResponse },
  )

  // Fetch more results incrementally
  async function fetchMore(targetSize: number): Promise<void> {
    const q = toValue(query).trim()
    const provider = searchProvider.value

    if (!q) {
      cache.value = null
      return
    }

    // If query or provider changed, reset cache
    if (cache.value && (cache.value.query !== q || cache.value.provider !== provider)) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = cache.value?.total ?? Infinity

    // Already have enough or no more to fetch
    if (currentCount >= targetSize || currentCount >= total) {
      return
    }

    isLoadingMore.value = true

    try {
      const from = currentCount
      const size = Math.min(targetSize - currentCount, total - currentCount)

      if (provider === 'algolia') {
        // Algolia incremental fetch
        const response = await searchAlgolia(q, { size, from })

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
      } else {
        // npm registry incremental fetch
        const params = new URLSearchParams()
        params.set('text', q)
        params.set('size', String(size))
        params.set('from', String(from))

        const { data: response } = await $npmRegistry<NpmSearchResponse>(
          `/-/v1/search?${params.toString()}`,
          {},
          60,
        )

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
      }

      // If we still need more, fetch again recursively
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

  // Watch for size increases
  watch(
    () => toValue(options).size,
    async (newSize, oldSize) => {
      if (!newSize) return
      if (oldSize && newSize > oldSize && toValue(query).trim()) {
        await fetchMore(newSize)
      }
    },
  )

  // Re-search when provider changes
  watch(searchProvider, async () => {
    cache.value = null
    await asyncData.refresh()
    const targetSize = toValue(options).size
    if (targetSize) {
      await fetchMore(targetSize)
    }
  })

  // Computed data that uses cache
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

  // Whether there are more results available
  const hasMore = computed(() => {
    if (!cache.value) return true
    return cache.value.objects.length < cache.value.total
  })

  return {
    ...asyncData,
    /** Reactive search results (uses cache in incremental mode) */
    data,
    /** Whether currently loading more results */
    isLoadingMore,
    /** Whether there are more results available */
    hasMore,
    /** Manually fetch more results up to target size */
    fetchMore,
    /** Whether the search was rate limited by npm (429 error) */
    isRateLimited: readonly(isRateLimited),
  }
}
