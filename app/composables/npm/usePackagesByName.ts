import type { NpmSearchResult, PackageMetaResponse } from '#shared/types'
import { hash } from 'ohash'
import { mapWithConcurrency } from '#shared/utils/async'
import { metaToSearchResult } from './search-utils'

/**
 * Card metadata for packages by exact name, as on org pages: one Algolia lookup when it's the
 * search provider, else lightweight registry lookups. Missing packages are left out.
 */
export function usePackagesByName(names: MaybeRefOrGetter<string[]>) {
  const { searchProviderValue } = useSearchProvider()
  const { getPackagesByName } = useAlgoliaSearch()

  return useLazyAsyncData(
    // Hashed: a collection can list up to 1000 names
    () => `packages-by-name:${searchProviderValue.value}:${hash(toValue(names))}`,
    async (_nuxtApp, { signal }) => {
      const packageNames = toValue(names)
      if (packageNames.length === 0) return new Map<string, NpmSearchResult>()

      let results: NpmSearchResult[] = []
      if (searchProviderValue.value === 'algolia') {
        results = await getPackagesByName(packageNames)
          .then(response => response.objects)
          .catch(() => [])
      }
      if (results.length === 0) {
        const metas = await mapWithConcurrency(
          packageNames,
          name =>
            $fetch<PackageMetaResponse>(`/api/registry/package-meta/${encodePackageName(name)}`, {
              signal,
            }).catch(() => null),
          10,
        )
        results = metas
          .filter((meta): meta is PackageMetaResponse => meta !== null)
          .map(metaToSearchResult)
      }
      return new Map(results.map(result => [result.package.name, result]))
    },
    { default: () => new Map<string, NpmSearchResult>() },
  )
}
