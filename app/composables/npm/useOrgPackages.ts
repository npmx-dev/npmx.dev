import type { NpmSearchResponse, NpmSearchResult, PackageMetaResponse } from '#shared/types'
import { emptySearchResponse, metaToSearchResult } from './search-utils'
import { mapWithConcurrency } from '#shared/utils/async'

/**
 * Maximum number of packages to fetch metadata for.
 * Large orgs (e.g. @types with 8000+ packages) would otherwise trigger
 * thousands of network requests, causing severe performance degradation.
 * Algolia batches in chunks of 1000; npm fallback fetches individually.
 */
const MAX_ORG_PACKAGES = 1000

export interface OrgPackagesResponse extends NpmSearchResponse {
  /** Total number of packages in the org (may exceed objects.length if capped) */
  totalPackages: number
}

function emptyOrgResponse(): OrgPackagesResponse {
  return {
    ...emptySearchResponse(),
    totalPackages: 0,
  }
}

/**
 * Fetch packages for an npm organization.
 *
 * 1. Gets the authoritative package list from the npm registry (single request)
 * 2. Caps to MAX_ORG_PACKAGES to prevent excessive network requests
 * 3. Fetches metadata from Algolia by exact name (batched in chunks of 1000)
 * 4. Falls back to lightweight server-side package-meta lookups
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
        return emptyOrgResponse()
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
        // Check if this is a 404 (org not found)
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
        // For other errors (network, etc.), return empty array to be safe
        packageNames = []
      }

      if (packageNames.length === 0) {
        return emptyOrgResponse()
      }

      const totalPackages = packageNames.length

      // Cap the number of packages to fetch metadata for
      if (packageNames.length > MAX_ORG_PACKAGES) {
        packageNames = packageNames.slice(0, MAX_ORG_PACKAGES)
      }

      // Fetch metadata + downloads from Algolia (batched in chunks of 1000)
      if (searchProviderValue.value === 'algolia') {
        try {
          const response = await getPackagesByName(packageNames)
          if (response.objects.length > 0) {
            return {
              ...response,
              totalPackages,
            } satisfies OrgPackagesResponse
          }
        } catch {
          // Fall through to npm registry path
        }
      }

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
        totalPackages,
        time: new Date().toISOString(),
      } satisfies OrgPackagesResponse
    },
    { default: emptyOrgResponse },
  )

  return asyncData
}
