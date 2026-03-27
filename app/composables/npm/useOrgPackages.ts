import type { NpmSearchResponse, NpmSearchResult, PackageMetaResponse } from '#shared/types'
import { emptySearchResponse, metaToSearchResult } from './search-utils'
import { mapWithConcurrency } from '#shared/utils/async'

/** Number of packages to fetch metadata for in the initial load */
const INITIAL_BATCH_SIZE = 250

/** Max names per Algolia getObjects request */
const ALGOLIA_BATCH_SIZE = 1000

export interface OrgPackagesResponse extends NpmSearchResponse {
  /** Total number of packages in the org (may exceed objects.length if not all loaded yet) */
  totalPackages: number
  /** Whether there are more packages that haven't been loaded yet */
  isTruncated: boolean
}

function emptyOrgResponse(): OrgPackagesResponse {
  return {
    ...emptySearchResponse(),
    totalPackages: 0,
    isTruncated: false,
  }
}

/**
 * Fetch packages for an npm organization with progressive loading.
 *
 * 1. Gets the authoritative package list from the npm registry (single request)
 * 2. Fetches metadata for the first batch immediately
 * 3. Remaining packages are loaded on-demand via `loadAll()`
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  const route = useRoute()
  const { searchProvider } = useSearchProvider()
  const searchProviderValue = computed(() => {
    const p = normalizeSearchParam(route.query.p)
    if (p === 'npm' || searchProvider.value === 'npm') return 'npm'
    return 'algolia'
  })
  const { getPackagesByNameSlice } = useAlgoliaSearch()

  // --- Progressive loading state ---
  const cache = shallowRef<{
    org: string
    allNames: string[]
    objects: NpmSearchResult[]
    totalPackages: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  const hasMore = computed(() => {
    if (!cache.value) return false
    return cache.value.objects.length < cache.value.allNames.length
  })

  // Promise lock to prevent duplicate loadAll calls
  let loadAllPromise: Promise<void> | null = null

  const asyncData = useLazyAsyncData(
    () => `org-packages:${searchProviderValue.value}:${toValue(orgName)}`,
    async ({ ssrContext }, { signal }) => {
      const org = toValue(orgName)
      if (!org) {
        return emptyOrgResponse()
      }

      // Get the authoritative package list from the npm registry
      let packageNames: string[]
      try {
        const { packages } = await $fetch<{ packages: string[]; count: number }>(
          `/api/registry/org/${encodeURIComponent(org)}/packages`,
          { signal },
        )
        packageNames = packages
      } catch (err) {
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404) {
          const error = createError({
            statusCode: 404,
            statusMessage: 'Organization not found',
            message: `The organization "@${org}" does not exist on npm`,
          })
          if (import.meta.server) {
            ssrContext!.payload.error = error
          }
          throw error
        }
        packageNames = []
      }

      if (packageNames.length === 0) {
        cache.value = { org, allNames: [], objects: [], totalPackages: 0 }
        return emptyOrgResponse()
      }

      const totalPackages = packageNames.length
      const initialNames = packageNames.slice(0, INITIAL_BATCH_SIZE)

      // Fetch metadata for first batch
      let initialObjects: NpmSearchResult[] = []

      if (searchProviderValue.value === 'algolia') {
        try {
          initialObjects = await getPackagesByNameSlice(initialNames)
        } catch {
          // Fall through to npm fallback
        }
      }

      // Staleness guard
      if (toValue(orgName) !== org) return emptyOrgResponse()

      // npm fallback for initial batch
      if (initialObjects.length === 0) {
        const metaResults = await mapWithConcurrency(
          initialNames,
          async name => {
            try {
              return await $fetch<PackageMetaResponse>(
                `/api/registry/package-meta/${encodePackageName(name)}`,
                { signal },
              )
            } catch {
              return null
            }
          },
          10,
        )

        if (toValue(orgName) !== org) return emptyOrgResponse()

        initialObjects = metaResults
          .filter((meta): meta is PackageMetaResponse => meta !== null)
          .map(metaToSearchResult)
      }

      cache.value = {
        org,
        allNames: packageNames,
        objects: initialObjects,
        totalPackages,
      }

      return {
        isStale: false,
        objects: initialObjects,
        total: initialObjects.length,
        totalPackages,
        isTruncated: packageNames.length > initialObjects.length,
        time: new Date().toISOString(),
      } satisfies OrgPackagesResponse
    },
    { default: emptyOrgResponse },
  )

  /** Load all remaining packages that weren't fetched in the initial batch */
  async function loadAll(): Promise<void> {
    if (!hasMore.value) return

    // Reuse existing promise if already running
    if (loadAllPromise) {
      await loadAllPromise
      return
    }

    loadAllPromise = _doLoadAll()
    try {
      await loadAllPromise
    } finally {
      loadAllPromise = null
    }
  }

  async function _doLoadAll(): Promise<void> {
    const currentCache = cache.value
    if (!currentCache || currentCache.objects.length >= currentCache.allNames.length) return

    const org = currentCache.org
    isLoadingMore.value = true

    try {
      const remainingNames = currentCache.allNames.slice(currentCache.objects.length)

      if (searchProviderValue.value === 'algolia') {
        // Split remaining into batches and fetch in parallel
        const batches: string[][] = []
        for (let i = 0; i < remainingNames.length; i += ALGOLIA_BATCH_SIZE) {
          batches.push(remainingNames.slice(i, i + ALGOLIA_BATCH_SIZE))
        }

        const results = await Promise.allSettled(
          batches.map(batch => getPackagesByNameSlice(batch)),
        )

        if (toValue(orgName) !== org) return

        const newObjects: NpmSearchResult[] = []
        for (const result of results) {
          if (result.status === 'fulfilled') {
            newObjects.push(...result.value)
          }
        }

        if (newObjects.length > 0) {
          const existingNames = new Set(currentCache.objects.map(o => o.package.name))
          const deduped = newObjects.filter(o => !existingNames.has(o.package.name))
          cache.value = {
            ...currentCache,
            objects: [...currentCache.objects, ...deduped],
          }
        }
      } else {
        // npm fallback: fetch with concurrency
        const metaResults = await mapWithConcurrency(
          remainingNames,
          async name => {
            try {
              return await $fetch<PackageMetaResponse>(
                `/api/registry/package-meta/${encodePackageName(name)}`,
              )
            } catch {
              return null
            }
          },
          10,
        )

        if (toValue(orgName) !== org) return

        const newObjects = metaResults
          .filter((meta): meta is PackageMetaResponse => meta !== null)
          .map(metaToSearchResult)

        if (newObjects.length > 0) {
          const existingNames = new Set(currentCache.objects.map(o => o.package.name))
          const deduped = newObjects.filter(o => !existingNames.has(o.package.name))
          cache.value = {
            ...currentCache,
            objects: [...currentCache.objects, ...deduped],
          }
        }
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  // Reset cache when provider changes
  watch(
    () => searchProviderValue.value,
    () => {
      cache.value = null
      loadAllPromise = null
    },
  )

  // Computed data that prefers cache
  const data = computed<OrgPackagesResponse | null>(() => {
    const org = toValue(orgName)
    if (cache.value && cache.value.org === org) {
      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.objects.length,
        totalPackages: cache.value.totalPackages,
        isTruncated: cache.value.objects.length < cache.value.allNames.length,
        time: new Date().toISOString(),
      }
    }
    return asyncData.data.value
  })

  return {
    ...asyncData,
    data,
    isLoadingMore,
    hasMore,
    loadAll,
  }
}
