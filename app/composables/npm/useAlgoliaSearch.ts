import type { NpmSearchResponse, NpmSearchResult } from '#shared/types'
import {
  liteClient as algoliasearch,
  type LiteClient,
  type SearchResponse,
} from 'algoliasearch/lite'

/**
 * Algolia search client for npm packages.
 * Credentials and index name come from runtimeConfig.public.algolia.
 */
let _searchClient: LiteClient | null = null
let _configuredAppId: string | null = null

function getAlgoliaClient(): LiteClient {
  const { algolia } = useRuntimeConfig().public
  // Re-create client if app ID changed (shouldn't happen, but be safe)
  if (!_searchClient || _configuredAppId !== algolia.appId) {
    _searchClient = algoliasearch(algolia.appId, algolia.apiKey)
    _configuredAppId = algolia.appId
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
 * Search npm packages via Algolia.
 * Returns results in the same NpmSearchResponse format as the npm registry API.
 */
export async function searchAlgolia(
  query: string,
  options: AlgoliaSearchOptions = {},
): Promise<NpmSearchResponse> {
  const client = getAlgoliaClient()

  const { results } = await client.search([
    {
      indexName: 'npm-search',
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

  const response = results[0] as SearchResponse<AlgoliaHit>

  return {
    isStale: false,
    objects: response.hits.map(hitToSearchResult),
    total: response.nbHits!,
    time: new Date().toISOString(),
  }
}

/**
 * Fetch all packages in an Algolia scope (org or user).
 * Uses facet filters for efficient server-side filtering.
 *
 * For orgs: filters by `owner.name:orgname` which matches scoped packages.
 * For users: filters by `owner.name:username` which matches maintainer.
 */
export async function searchAlgoliaByOwner(
  ownerName: string,
  options: { maxResults?: number } = {},
): Promise<NpmSearchResponse> {
  const client = getAlgoliaClient()
  const max = options.maxResults ?? 1000

  const allHits: AlgoliaHit[] = []
  let offset = 0
  const batchSize = 200

  // Algolia supports up to 1000 results per query with offset/length pagination
  while (offset < max) {
    const length = Math.min(batchSize, max - offset)

    const { results } = await client.search([
      {
        indexName: 'npm-search',
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

    const response = results[0] as SearchResponse<AlgoliaHit>
    allHits.push(...response.hits)

    // If we got fewer than requested, we've exhausted all results
    if (response.hits.length < length || allHits.length >= response.nbHits!) {
      break
    }

    offset += length
  }

  return {
    isStale: false,
    objects: allHits.map(hitToSearchResult),
    total: allHits.length,
    time: new Date().toISOString(),
  }
}
