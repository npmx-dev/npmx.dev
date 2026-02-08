import type { NpmSearchResponse, NpmSearchResult } from '#shared/types'
import { emptySearchResponse } from './useNpmSearch'

/** Default page size for incremental loading (npm registry path) */
const PAGE_SIZE = 50 as const

/** npm search API practical limit for maintainer queries */
const MAX_RESULTS = 250

/**
 * Fetch packages for a given npm user/maintainer.
 *
 * The composable handles all loading strategy internally based on the active
 * search provider. Consumers get a uniform interface regardless of provider:
 *
 * - **Algolia**: Fetches all packages at once via `owner.name` filter (fast).
 * - **npm**: Incrementally paginates through `maintainer:` search results.
 *
 * @example
 * ```ts
 * const { data, status, hasMore, isLoadingMore, loadMore } = useUserPackages(username)
 * ```
 */
export function useUserPackages(username: MaybeRefOrGetter<string>) {
  const { searchProvider } = useSearchProvider()
  const { $npmRegistry } = useNuxtApp()
  const { searchByOwner } = useAlgoliaSearch()

  // --- Incremental loading state (npm path) ---
  const currentPage = shallowRef(1)

  const cache = shallowRef<{
    username: string
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  const asyncData = useLazyAsyncData(
    () => `user-packages:${searchProvider.value}:${toValue(username)}`,
    async ({ $npmRegistry }, { signal }) => {
      const user = toValue(username)
      if (!user) {
        return emptySearchResponse
      }

      const provider = searchProvider.value

      // --- Algolia: fetch all at once ---
      if (provider === 'algolia') {
        try {
          const response = await searchByOwner(user)

          // Guard against stale response (user/provider changed during await)
          if (user !== toValue(username) || provider !== searchProvider.value) {
            return emptySearchResponse
          }

          cache.value = {
            username: user,
            objects: response.objects,
            total: response.total,
          }
          return response
        } catch {
          // Fall through to npm registry path on Algolia failure
        }
      }

      // --- npm registry: initial page ---
      cache.value = null
      currentPage.value = 1

      const params = new URLSearchParams()
      params.set('text', `maintainer:${user}`)
      params.set('size', String(PAGE_SIZE))

      const { data: response, isStale } = await $npmRegistry<NpmSearchResponse>(
        `/-/v1/search?${params.toString()}`,
        { signal },
        60,
      )

      // Guard against stale response (user/provider changed during await)
      if (user !== toValue(username) || provider !== searchProvider.value) {
        return emptySearchResponse
      }

      cache.value = {
        username: user,
        objects: response.objects,
        total: response.total,
      }

      return { ...response, isStale }
    },
    { default: () => emptySearchResponse },
  )
  // --- Fetch more (npm path only) ---
  async function fetchMore(): Promise<void> {
    const user = toValue(username)
    const provider = searchProvider.value
    if (!user || provider !== 'npm') return

    if (cache.value && cache.value.username !== user) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = Math.min(cache.value?.total ?? Infinity, MAX_RESULTS)

    if (currentCount >= total) return

    isLoadingMore.value = true

    try {
      const from = currentCount
      const size = Math.min(PAGE_SIZE, total - currentCount)

      const params = new URLSearchParams()
      params.set('text', `maintainer:${user}`)
      params.set('size', String(size))
      params.set('from', String(from))

      const { data: response } = await $npmRegistry<NpmSearchResponse>(
        `/-/v1/search?${params.toString()}`,
        {},
        60,
      )

      // Guard against stale response
      if (user !== toValue(username) || provider !== searchProvider.value) return

      if (cache.value && cache.value.username === user) {
        const existingNames = new Set(cache.value.objects.map(obj => obj.package.name))
        const newObjects = response.objects.filter(obj => !existingNames.has(obj.package.name))
        cache.value = {
          username: user,
          objects: [...cache.value.objects, ...newObjects],
          total: response.total,
        }
      } else {
        cache.value = {
          username: user,
          objects: response.objects,
          total: response.total,
        }
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  /** Load the next page of results (no-op if all loaded or using Algolia) */
  async function loadMore(): Promise<void> {
    if (isLoadingMore.value || !hasMore.value) return
    currentPage.value++
    await fetchMore()
  }

  /** Load all remaining results at once (e.g. when user starts filtering) */
  async function loadAll(): Promise<void> {
    if (!hasMore.value) return

    isLoadingMore.value = true
    try {
      while (hasMore.value) {
        await fetchMore()
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  // Re-fetch when provider changes
  watch(searchProvider, () => {
    cache.value = null
    currentPage.value = 1
    asyncData.refresh()
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

  /** Whether there are more results available to load */
  const hasMore = computed(() => {
    // Algolia fetches everything in one go
    if (searchProvider.value !== 'npm') return false
    if (!cache.value) return true
    return cache.value.objects.length < Math.min(cache.value.total, MAX_RESULTS)
  })

  return {
    ...asyncData,
    /** Reactive package results */
    data,
    /** Whether currently loading more results */
    isLoadingMore,
    /** Whether there are more results available */
    hasMore,
    /** Load next page of results */
    loadMore,
    /** Load all remaining results (for filter/sort) */
    loadAll,
    /** Default page size (for display) */
    pageSize: PAGE_SIZE,
  }
}
