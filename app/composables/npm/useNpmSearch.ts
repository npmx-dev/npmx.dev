import type { NpmSearchResponse, PackageMetaResponse } from '#shared/types'
import { emptySearchResponse, metaToSearchResult } from './search-utils'

export interface NpmSearchOptions {
  size?: number
  from?: number
}

async function checkOrgExists(name: string): Promise<boolean> {
  try {
    const scopePrefix = `@${name.toLowerCase()}/`
    const response = await $fetch<{
      total: number
      objects: Array<{ package: { name: string } }>
    }>(`${NPM_REGISTRY}/-/v1/search`, { query: { text: `@${name}`, size: 5 } })
    return response.objects.some(obj => obj.package.name.toLowerCase().startsWith(scopePrefix))
  } catch {
    return false
  }
}

async function checkUserExists(name: string): Promise<boolean> {
  try {
    const response = await $fetch<{ total: number }>(`${NPM_REGISTRY}/-/v1/search`, {
      query: { text: `maintainer:${name}`, size: 1 },
    })
    return response.total > 0
  } catch {
    return false
  }
}

/**
 * Composable providing npm registry search.
 * Must be called during component setup.
 */
export function useNpmSearch() {
  const { $npmRegistry } = useNuxtApp()

  /**
   * Search npm packages. Single-character queries fetch lightweight metadata
   * via a server proxy since the search API returns poor results for them.
   */
  async function search(
    query: string,
    options: NpmSearchOptions = {},
    signal?: AbortSignal,
  ): Promise<NpmSearchResponse> {
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
    search,
    checkOrgExists,
    checkUserExists,
  }
}
