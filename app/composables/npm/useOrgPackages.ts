import type { NpmSearchResponse, NpmSearchResult, MinimalPackument } from '#shared/types'
import { emptySearchResponse, packumentToSearchResult } from './useNpmSearch'
import { mapWithConcurrency } from '#shared/utils/async'

/**
 * Fetch all packages for an npm organization.
 *
 * 1. Gets the authoritative package list from the npm registry (single request)
 * 2. Fetches metadata from Algolia by exact name (single request)
 * 3. Falls back to individual packument fetches when Algolia is unavailable
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  const { searchProvider } = useSearchProvider()
  const { getPackagesByName } = useAlgoliaSearch()

  const asyncData = useLazyAsyncData(
    () => `org-packages:${searchProvider.value}:${toValue(orgName)}`,
    async ({ $npmRegistry, ssrContext }, { signal }) => {
      const org = toValue(orgName)
      if (!org) {
        return emptySearchResponse
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
        return emptySearchResponse
      }

      // Fetch metadata + downloads from Algolia (single request via getObjects)
      if (searchProvider.value === 'algolia') {
        try {
          const response = await getPackagesByName(packageNames)
          if (response.objects.length > 0) {
            return response
          }
        } catch {
          // Fall through to npm registry path
        }
      }

      // npm fallback: fetch packuments individually
      const packuments = await mapWithConcurrency(
        packageNames,
        async name => {
          try {
            const encoded = encodePackageName(name)
            const { data: pkg } = await $npmRegistry<MinimalPackument>(`/${encoded}`, {
              signal,
            })
            return pkg
          } catch {
            return null
          }
        },
        10,
      )

      const validPackuments = packuments.filter(
        (pkg): pkg is MinimalPackument => pkg !== null && !!pkg['dist-tags'],
      )

      const results: NpmSearchResult[] = validPackuments.map(pkg => packumentToSearchResult(pkg))

      return {
        isStale: false,
        objects: results,
        total: results.length,
        time: new Date().toISOString(),
      } satisfies NpmSearchResponse
    },
    { default: () => emptySearchResponse },
  )

  return asyncData
}
