import type { NpmSearchResponse, PackageMetaResponse } from '#shared/types'
import { emptySearchResponse, metaToSearchResult } from './search-utils'

export interface NpmSearchOptions {
  /** Number of results */
  size?: number
  /** Offset for pagination */
  from?: number
}

/**
 * Composable that provides npm registry search functions.
 *
 * Mirrors the API shape of `useAlgoliaSearch` so that `useSearch` can
 * swap between providers without branching on implementation details.
 *
 * Must be called during component setup (or inside another composable)
 * because it reads from `useNuxtApp()`. The returned functions are safe
 * to call at any time (event handlers, async callbacks, etc.).
 */
export function useNpmSearch() {
  const { $npmRegistry } = useNuxtApp()

  /**
   * Search npm packages via the npm registry API.
   * Returns results in the same `NpmSearchResponse` format as `useAlgoliaSearch`.
   *
   * Single-character queries are handled specially: they fetch lightweight
   * metadata from a server-side proxy instead of a search, because the
   * search API returns poor results for single-char terms. The proxy
   * fetches the full packument + download counts server-side and returns
   * only the fields needed for package cards.
   */
  async function search(
    query: string,
    options: NpmSearchOptions = {},
    signal?: AbortSignal,
  ): Promise<NpmSearchResponse> {
    // Single-character: fetch lightweight metadata via server proxy
    if (query.length === 1) {
      try {
        const meta = await $fetch<PackageMetaResponse>(
          `/api/registry/package-meta/${encodePackageName(query)}`,
          { signal },
        )

        const result = metaToSearchResult(meta)

        return {
          objects: [result],
          total: 1,
          isStale: false,
          time: new Date().toISOString(),
        }
      } catch {
        return emptySearchResponse()
      }
    }

    // Standard search
    const params = new URLSearchParams()
    params.set('text', query)
    params.set('size', String(options.size ?? 25))
    if (options.from) {
      params.set('from', String(options.from))
    }

    const { data: response, isStale } = await $npmRegistry<NpmSearchResponse>(
      `/-/v1/search?${params.toString()}`,
      { signal },
      60,
    )

    return { ...response, isStale }
  }

  return {
    /** Search packages by text query */
    search,
  }
}
