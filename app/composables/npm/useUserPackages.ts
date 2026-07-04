import type { NpmSearchResponse } from '#shared/types'

/** Default page size for incremental loading (npm registry path) */
const PAGE_SIZE = 50 as const

/** npm search API practical limit for maintainer queries */
const MAX_RESULTS = 250

type RawNpmSearchResponse = Omit<NpmSearchResponse, 'isStale'> &
  Partial<Pick<NpmSearchResponse, 'isStale'>>

type UserPackagesPrefetchWindow = Window & {
  __NPMX_USER_PACKAGES_PREFETCH__?: Record<string, Promise<RawNpmSearchResponse | null> | undefined>
}

function normalizeNpmSearchResponse(response: RawNpmSearchResponse): NpmSearchResponse {
  return {
    ...response,
    isStale: response.isStale ?? false,
  }
}

async function getPrehydratedNpmUserPackages(username: string): Promise<NpmSearchResponse | null> {
  if (!import.meta.client) return null

  const prefetches = (window as UserPackagesPrefetchWindow).__NPMX_USER_PACKAGES_PREFETCH__
  const response = await prefetches?.[username.toLowerCase()]
  if (!response) return null

  delete prefetches?.[username.toLowerCase()]
  return normalizeNpmSearchResponse(response)
}

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
  const route = useRoute()
  const { searchProvider } = useSearchProvider()
  const searchProviderValue = computed(() => {
    const p = normalizeSearchParam(route.query.p)
    if (p === 'npm' || searchProvider.value === 'npm') return 'npm'
    return 'algolia'
  })
  // this is only used in npm path, but we need to extract it when the composable runs
  const { $npmRegistry } = useNuxtApp()
  const { searchByMaintainer } = useAlgoliaSearch()

  onPrehydrate(el => {
    let settings
    try {
      settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
    } catch {
      settings = {}
    }
    if (settings.searchProvider !== 'npm') return

    const params = new URLSearchParams(window.location.search)
    if (params.get('p') === 'npm') return

    const prehydrateUsername =
      el?.getAttribute('data-user-packages-username') ||
      decodeURIComponent(window.location.pathname.split('/')[1] || '').replace(/^~/, '')
    if (!prehydrateUsername) return

    const prefetchWindow = window as typeof window & {
      __NPMX_USER_PACKAGES_PREFETCH__?: Record<string, Promise<unknown> | undefined>
    }
    const prefetches = (prefetchWindow.__NPMX_USER_PACKAGES_PREFETCH__ ||= {})
    if (prefetches[prehydrateUsername]) return

    const searchParams = new URLSearchParams()
    searchParams.set('text', `maintainer:${prehydrateUsername}`)
    searchParams.set('size', '50')

    prefetches[prehydrateUsername] = fetch(
      `https://registry.npmjs.org/-/v1/search?${searchParams}`,
      {
        cache: 'force-cache',
      },
    )
      .then(response => {
        if (!response.ok) return null
        return response.json()
      })
      .catch(() => null)
  })

  // --- Incremental loading state (npm path) ---
  const currentPage = shallowRef(1)

  /** Tracks which provider actually served the current data (may differ from
   *  searchProvider when Algolia returns empty and we fall through to npm) */
  const activeProvider = shallowRef<'npm' | 'algolia'>(searchProviderValue.value)

  const cache = shallowRef<{
    username: string
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  const asyncData = useLazyAsyncData(
    () => `user-packages:${searchProviderValue.value}:${toValue(username)}`,
    async (_nuxtApp, { signal }) => {
      const user = toValue(username)
      if (!user) {
        return emptySearchResponse()
      }

      const provider = searchProviderValue.value

      // --- Algolia: fetch all at once ---
      if (provider === 'algolia') {
        try {
          const response = await searchByMaintainer(user)

          // Guard against stale response (user/provider changed during await)
          if (user !== toValue(username) || provider !== searchProviderValue.value) {
            return emptySearchResponse()
          }

          // If Algolia returns results, use them. If empty, fall through to npm
          // registry which uses `maintainer:` search (matches all maintainers,
          // not just the primary owner that Algolia's owner.name indexes).
          if (response.objects.length > 0) {
            activeProvider.value = 'algolia'
            cache.value = {
              username: user,
              objects: response.objects,
              total: response.total,
            }
            return response
          }
        } catch {
          // Fall through to npm registry path on Algolia failure
        }
      }

      // --- npm registry: initial page (or Algolia fallback) ---
      activeProvider.value = 'npm'
      cache.value = null
      currentPage.value = 1

      const prehydrated = await getPrehydratedNpmUserPackages(user)
      if (prehydrated) {
        if (user !== toValue(username) || provider !== searchProviderValue.value) {
          return emptySearchResponse()
        }

        cache.value = {
          username: user,
          objects: prehydrated.objects,
          total: prehydrated.total,
        }
        return prehydrated
      }

      const params = new URLSearchParams()
      params.set('text', `maintainer:${user}`)
      params.set('size', String(PAGE_SIZE))

      const { data: response, isStale } = await $npmRegistry<NpmSearchResponse>(
        `/-/v1/search?${params.toString()}`,
        { signal },
        60,
      )

      // Guard against stale response (user/provider changed during await)
      if (user !== toValue(username) || provider !== searchProviderValue.value) {
        return emptySearchResponse()
      }

      cache.value = {
        username: user,
        objects: response.objects,
        total: response.total,
      }

      return { ...response, isStale }
    },
    { default: emptySearchResponse },
  )
  // --- Fetch more (npm path only) ---
  /**
   * Fetch the next page of results from npm registry.
   * @param manageLoadingState - When false, caller manages isLoadingMore (used by loadAll to prevent flicker)
   */
  async function fetchMore(manageLoadingState = true): Promise<void> {
    const user = toValue(username)
    // Use activeProvider: if Algolia fell through to npm, we still need pagination
    if (!user || activeProvider.value !== 'npm') return

    if (cache.value && cache.value.username !== user) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = Math.min(cache.value?.total ?? Infinity, MAX_RESULTS)

    if (currentCount >= total) return

    if (manageLoadingState) isLoadingMore.value = true

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
      if (user !== toValue(username) || activeProvider.value !== 'npm') return

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
      if (manageLoadingState) isLoadingMore.value = false
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
        await fetchMore(false)
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  // asyncdata will automatically rerun due to key, but we need to reset cache/page
  // when provider changes
  watch(
    () => searchProviderValue.value,
    newProvider => {
      cache.value = null
      currentPage.value = 1
      activeProvider.value = newProvider
    },
  )

  // Computed data that uses cache (only if it belongs to the current username)
  const data = computed<NpmSearchResponse | null>(() => {
    const user = toValue(username)
    if (cache.value && cache.value.username === user) {
      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.total,
        time: new Date().toISOString(),
      }
    }
    return asyncData.data.value
  })

  /** Whether there are more results available to load (npm path only) */
  const hasMore = computed(() => {
    if (!toValue(username)) return false
    // Algolia fetches everything in one request; only npm needs pagination
    if (activeProvider.value !== 'npm') return false
    if (!cache.value) return true
    // npm path: more available if we haven't hit the server total or our cap
    const fetched = cache.value.objects.length
    const available = cache.value.total
    return fetched < available && fetched < MAX_RESULTS
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
