import type { NuxtApp } from '#app'
import type { NpmSearchResponse, NpmSearchResult, MinimalPackument } from '#shared/types'
import { emptySearchResponse, packumentToSearchResult } from './useNpmSearch'
import { mapWithConcurrency } from '#shared/utils/async'

/**
 * Fetch downloads for multiple packages.
 * Returns a map of package name -> weekly downloads.
 * Uses bulk API for unscoped packages, parallel individual requests for scoped.
 * Note: npm bulk downloads API does not support scoped packages.
 */
async function fetchBulkDownloads(
  $npmApi: NuxtApp['$npmApi'],
  packageNames: string[],
  options: Parameters<typeof $fetch>[1] = {},
): Promise<Map<string, number>> {
  const downloads = new Map<string, number>()
  if (packageNames.length === 0) return downloads

  // Separate scoped and unscoped packages
  const scopedPackages = packageNames.filter(n => n.startsWith('@'))
  const unscopedPackages = packageNames.filter(n => !n.startsWith('@'))

  // Fetch unscoped packages via bulk API (max 128 per request)
  const bulkPromises: Promise<void>[] = []
  const chunkSize = 100
  for (let i = 0; i < unscopedPackages.length; i += chunkSize) {
    const chunk = unscopedPackages.slice(i, i + chunkSize)
    bulkPromises.push(
      (async () => {
        try {
          const response = await $npmApi<Record<string, { downloads: number } | null>>(
            `/downloads/point/last-week/${chunk.join(',')}`,
            options,
          )
          for (const [name, data] of Object.entries(response.data)) {
            if (data?.downloads !== undefined) {
              downloads.set(name, data.downloads)
            }
          }
        } catch {
          // Ignore errors - downloads are optional
        }
      })(),
    )
  }

  // Fetch scoped packages in parallel batches (concurrency limit to avoid overwhelming the API)
  // Use Promise.allSettled to not fail on individual errors
  const scopedBatchSize = 20 // Concurrent requests per batch
  for (let i = 0; i < scopedPackages.length; i += scopedBatchSize) {
    const batch = scopedPackages.slice(i, i + scopedBatchSize)
    bulkPromises.push(
      (async () => {
        const results = await Promise.allSettled(
          batch.map(async name => {
            const encoded = encodePackageName(name)
            const { data } = await $npmApi<{ downloads: number }>(
              `/downloads/point/last-week/${encoded}`,
            )
            return { name, downloads: data.downloads }
          }),
        )
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.downloads !== undefined) {
            downloads.set(result.value.name, result.value.downloads)
          }
        }
      })(),
    )
  }

  // Wait for all fetches to complete
  await Promise.all(bulkPromises)

  return downloads
}

/**
 * Fetch all packages for an npm organization
 * Returns search-result-like objects for compatibility with PackageList
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  const asyncData = useLazyAsyncData(
    () => `org-packages:${toValue(orgName)}`,
    async ({ $npmRegistry, $npmApi }, { signal }) => {
      const org = toValue(orgName)
      if (!org) {
        return emptySearchResponse
      }

      // Get all package names in the org
      let packageNames: string[]
      try {
        const { data } = await $npmRegistry<Record<string, string>>(
          `/-/org/${encodeURIComponent(org)}/package`,
          { signal },
        )
        packageNames = Object.keys(data)
      } catch (err) {
        // Check if this is a 404 (org not found)
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404) {
          throw createError({
            statusCode: 404,
            statusMessage: 'Organization not found',
            message: `The organization "@${org}" does not exist on npm`,
          })
        }
        // For other errors (network, etc.), return empty array to be safe
        packageNames = []
      }

      if (packageNames.length === 0) {
        return emptySearchResponse
      }

      // Fetch packuments and downloads in parallel
      const [packuments, downloads] = await Promise.all([
        // Fetch packuments with concurrency limit
        (async () => {
          const results = await mapWithConcurrency(
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
          // Filter out any unpublished packages (missing dist-tags)
          return results.filter(
            (pkg): pkg is MinimalPackument => pkg !== null && !!pkg['dist-tags'],
          )
        })(),
        // Fetch downloads in bulk
        fetchBulkDownloads($npmApi, packageNames, { signal }),
      ])

      // Convert to search results with download data
      const results: NpmSearchResult[] = packuments.map(pkg =>
        packumentToSearchResult(pkg, downloads.get(pkg.name)),
      )

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
