import type { NpmSearchResponse, NpmSearchResult } from '#shared/types'
import {
  liteClient as algoliasearch,
  type LiteClient,
  type SearchResponse,
} from 'algoliasearch/lite'

/**
 * Singleton Algolia client, keyed by appId to handle config changes.
 */
let _searchClient: LiteClient | null = null
let _configuredAppId: string | null = null

function getOrCreateClient(appId: string, apiKey: string): LiteClient {
  if (!_searchClient || _configuredAppId !== appId) {
    _searchClient = algoliasearch(appId, apiKey)
    _configuredAppId = appId
  }
  return _searchClient
}

interface AlgoliaOwner {
  name: string
  email?: string
  avatar?: string
  link?: string
}

interface AlgoliaRepo {
  url: string
  host: string
  user: string
  project: string
  path: string
  head?: string
  branch?: string
}

/**
 * Shape of a hit from the Algolia `npm-search` index.
 * Only includes fields we retrieve via `attributesToRetrieve`.
 */
interface AlgoliaHit {
  objectID: string
  name: string
  version: string
  description: string | null
  modified: number
  homepage: string | null
  repository: AlgoliaRepo | null
  owners: AlgoliaOwner[] | null
  downloadsLast30Days: number
  downloadsRatio: number
  popular: boolean
  keywords: string[]
  deprecated: boolean | string
  isDeprecated: boolean
  license: string | null
}

/** Fields we always request from Algolia to keep payload small */
const ATTRIBUTES_TO_RETRIEVE = [
  'name',
  'version',
  'description',
  'modified',
  'homepage',
  'repository',
  'owners',
  'downloadsLast30Days',
  'downloadsRatio',
  'popular',
  'keywords',
  'deprecated',
  'isDeprecated',
  'license',
]

function hitToSearchResult(hit: AlgoliaHit): NpmSearchResult {
  return {
    package: {
      name: hit.name,
      version: hit.version,
      description: hit.description || '',
      keywords: hit.keywords,
      date: new Date(hit.modified).toISOString(),
      links: {
        npm: `https://www.npmjs.com/package/${hit.name}`,
        homepage: hit.homepage || undefined,
        repository: hit.repository?.url || undefined,
      },
      maintainers: hit.owners
        ? hit.owners.map(owner => ({
            name: owner.name,
            email: owner.email,
          }))
        : [],
    },
    score: {
      final: 0,
      detail: {
        quality: hit.popular ? 1 : 0,
        popularity: hit.downloadsRatio,
        maintenance: 0,
      },
    },
    searchScore: 0,
    downloads: {
      weekly: Math.round(hit.downloadsLast30Days / 4.3),
    },
    updated: new Date(hit.modified).toISOString(),
  }
}

export interface AlgoliaSearchOptions {
  /** Number of results */
  size?: number
  /** Offset for pagination */
  from?: number
  /** Algolia filters expression (e.g. 'owner.name:username') */
  filters?: string
}

/**
 * Composable that provides Algolia search functions for npm packages.
 *
 * Must be called during component setup (or inside another composable)
 * because it reads from `useRuntimeConfig()`. The returned functions
 * are safe to call at any time (event handlers, async callbacks, etc.).
 */
export function useAlgoliaSearch() {
  const { algolia } = useRuntimeConfig().public
  const client = getOrCreateClient(algolia.appId, algolia.apiKey)
  const indexName = algolia.indexName

  /**
   * Search npm packages via Algolia.
   * Returns results in the same NpmSearchResponse format as the npm registry API.
   */
  async function search(
    query: string,
    options: AlgoliaSearchOptions = {},
  ): Promise<NpmSearchResponse> {
    const { results } = await client.search([
      {
        indexName,
        params: {
          query,
          offset: options.from,
          length: options.size,
          filters: options.filters || '',
          analyticsTags: ['npmx.dev'],
          attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
          attributesToHighlight: [],
        },
      },
    ])

    const response = results[0] as SearchResponse<AlgoliaHit> | undefined
    if (!response) {
      throw new Error('Algolia returned an empty response')
    }

    return {
      isStale: false,
      objects: response.hits.map(hitToSearchResult),
      total: response.nbHits ?? 0,
      time: new Date().toISOString(),
    }
  }

  /**
   * Fetch all packages for an Algolia owner (org or user).
   * Uses `owner.name` filter for efficient server-side filtering.
   */
  async function searchByOwner(
    ownerName: string,
    options: { maxResults?: number } = {},
  ): Promise<NpmSearchResponse> {
    const max = options.maxResults ?? 1000

    const allHits: AlgoliaHit[] = []
    let offset = 0
    let serverTotal = 0
    const batchSize = 200

    // Algolia supports up to 1000 results per query with offset/length pagination
    while (offset < max) {
      // Cap at both the configured max and the server's actual total (once known)
      const remaining = serverTotal > 0 ? Math.min(max, serverTotal) - offset : max - offset
      if (remaining <= 0) break
      const length = Math.min(batchSize, remaining)

      const { results } = await client.search([
        {
          indexName,
          params: {
            query: '',
            offset,
            length,
            filters: `owner.name:${ownerName}`,
            analyticsTags: ['npmx.dev'],
            attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
            attributesToHighlight: [],
          },
        },
      ])

      const response = results[0] as SearchResponse<AlgoliaHit> | undefined
      if (!response) break

      serverTotal = response.nbHits ?? 0
      allHits.push(...response.hits)

      // If we got fewer than requested, we've exhausted all results
      if (response.hits.length < length || allHits.length >= serverTotal) {
        break
      }

      offset += length
    }

    return {
      isStale: false,
      objects: allHits.map(hitToSearchResult),
      // Use server total so callers can detect truncation (allHits.length < total)
      total: serverTotal,
      time: new Date().toISOString(),
    }
  }

  /**
   * Fetch metadata for specific packages by exact name.
   * Uses Algolia's getObjects REST API to look up packages by objectID
   * (which equals the package name in the npm-search index).
   */
  async function getPackagesByName(packageNames: string[]): Promise<NpmSearchResponse> {
    if (packageNames.length === 0) {
      return { isStale: false, objects: [], total: 0, time: new Date().toISOString() }
    }

    // Algolia getObjects REST API: fetch up to 1000 objects by ID in a single request
    const response = await $fetch<{ results: (AlgoliaHit | null)[] }>(
      `https://${algolia.appId}-dsn.algolia.net/1/indexes/*/objects`,
      {
        method: 'POST',
        headers: {
          'x-algolia-api-key': algolia.apiKey,
          'x-algolia-application-id': algolia.appId,
        },
        body: {
          requests: packageNames.map(name => ({
            indexName,
            objectID: name,
            attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
          })),
        },
      },
    )

    const hits = response.results.filter((r): r is AlgoliaHit => r !== null && 'name' in r)
    return {
      isStale: false,
      objects: hits.map(hitToSearchResult),
      total: hits.length,
      time: new Date().toISOString(),
    }
  }

  return {
    /** Search packages by text query */
    search,
    /** Fetch all packages for an owner (org or user) */
    searchByOwner,
    /** Fetch metadata for specific packages by exact name */
    getPackagesByName,
  }
}
