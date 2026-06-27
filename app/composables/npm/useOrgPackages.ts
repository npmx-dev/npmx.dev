import type { NpmSearchResponse, NpmSearchResult, PackageMetaResponse } from '#shared/types'
import { emptySearchResponse, metaToSearchResult } from './search-utils'
import { mapWithConcurrency } from '#shared/utils/async'

/**
 * Fetch all packages for an npm organization.
 *
 * 1. Gets the authoritative package list from the npm registry (single request)
 * 2. Fetches metadata from Algolia by exact name (batched, max 1000 per request)
 * 3. Falls back to lightweight server-side package-meta lookups
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  const route = useRoute()
  const { searchProvider } = useSearchProvider()
  const searchProviderValue = computed(() => {
    const p = normalizeSearchParam(route.query.p)
    if (p === 'npm' || searchProvider.value === 'npm') return 'npm'
    return 'algolia'
  })
  const { getPackagesByName } = useAlgoliaSearch()

  const asyncData = useLazyAsyncData(
    () => `org-packages:${searchProviderValue.value}:${toValue(orgName)}`,
    async ({ ssrContext }, { signal }) => {
      const org = toValue(orgName)
      if (!org) {
        return emptySearchResponse()
      }

      // Get the authoritative package list from the npm registry (single request)
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
        return emptySearchResponse()
      }

      // Fetch metadata from Algolia (batched in chunks of 1000, parallel)
      if (searchProviderValue.value === 'algolia') {
        try {
          const response = await getPackagesByName(packageNames)
          if (response.objects.length > 0) {
            return response
          }
        } catch {
          // Fall through to npm registry path
        }
      }

      // Staleness guard
      if (toValue(orgName) !== org) return emptySearchResponse()

      // npm fallback: fetch lightweight metadata via server proxy
      const metaResults = await mapWithConcurrency(
        packageNames,
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

      const results: NpmSearchResult[] = metaResults
        .filter((meta): meta is PackageMetaResponse => meta !== null)
        .map(metaToSearchResult)

      return {
        isStale: false,
        objects: results,
        total: results.length,
        time: new Date().toISOString(),
      } satisfies NpmSearchResponse
    },
    { default: emptySearchResponse },
  )

  return asyncData
}
