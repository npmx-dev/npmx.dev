import type { NpmSearchResponse, NpmSearchResult } from '#shared/types'
import type { SearchProvider } from '~/composables/useSettings'
import { emptySearchResponse } from './search-utils'

export interface SearchOptions {
  /** Number of results to fetch */
  size?: number
}

export function useSearch(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<SearchOptions> = {},
) {
  const { searchProvider } = useSearchProvider()
  const { search: searchAlgolia } = useAlgoliaSearch()
  const { search: searchNpm } = useNpmSearch()

  const cache = shallowRef<{
    query: string
    provider: SearchProvider
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  const isRateLimited = ref(false)

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
        const response = await searchAlgolia(q, {
          size: opts.size ?? 25,
        })

        if (q !== toValue(query)) {
          return emptySearchResponse()
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
        // npm 429 responses lack CORS headers, so the browser reports "Failed to fetch"
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
