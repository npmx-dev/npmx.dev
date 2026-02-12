import type { NpmSearchResponse, NpmSearchResult } from '#shared/types'
import {
  liteClient as algoliasearch,
  type LiteClient,
  type SearchQuery,
  type SearchResponse,
} from 'algoliasearch/lite'

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

/** Shape of a hit from the Algolia `npm-search` index. */
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

const EXISTENCE_CHECK_ATTRS = ['name']

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
  size?: number
  from?: number
  filters?: string
}

/** Extra checks bundled into a single multi-search request. */
export interface AlgoliaMultiSearchChecks {
  name?: string
  checkOrg?: boolean
  checkUser?: boolean
  checkPackage?: string
}

export interface AlgoliaSearchWithSuggestionsResult {
  search: NpmSearchResponse
  orgExists: boolean
  userExists: boolean
  packageExists: boolean | null
}

/**
 * Composable providing Algolia search for npm packages.
 * Must be called during component setup.
 */
export function useAlgoliaSearch() {
  const { algolia } = useRuntimeConfig().public
  const client = getOrCreateClient(algolia.appId, algolia.apiKey)
  const indexName = algolia.indexName

  async function search(
    query: string,
    options: AlgoliaSearchOptions = {},
  ): Promise<NpmSearchResponse> {
    const { results } = await client.search({
      requests: [
        {
          indexName,
          query,
          offset: options.from,
          length: options.size,
          filters: options.filters || '',
          analyticsTags: ['npmx.dev'],
          attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
          attributesToHighlight: [],
        } satisfies SearchQuery,
      ],
    })

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

  /** Fetch all packages for an owner using `owner.name` filter with pagination. */
  async function searchByOwner(
    ownerName: string,
    options: { maxResults?: number } = {},
  ): Promise<NpmSearchResponse> {
    const max = options.maxResults ?? 1000

    const allHits: AlgoliaHit[] = []
    let offset = 0
    let serverTotal = 0
    const batchSize = 200

    while (offset < max) {
      const remaining = serverTotal > 0 ? Math.min(max, serverTotal) - offset : max - offset
      if (remaining <= 0) break
      const length = Math.min(batchSize, remaining)

      const { results } = await client.search({
        requests: [
          {
            indexName,
            query: '',
            offset,
            length,
            filters: `owner.name:${ownerName}`,
            analyticsTags: ['npmx.dev'],
            attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
            attributesToHighlight: [],
          } satisfies SearchQuery,
        ],
      })

      const response = results[0] as SearchResponse<AlgoliaHit> | undefined
      if (!response) break

      serverTotal = response.nbHits ?? 0
      allHits.push(...response.hits)

      if (response.hits.length < length || allHits.length >= serverTotal) {
        break
      }

      offset += length
    }

    return {
      isStale: false,
      objects: allHits.map(hitToSearchResult),
      total: serverTotal,
      time: new Date().toISOString(),
    }
  }

  /** Fetch metadata for specific packages by exact name using Algolia's getObjects API. */
  async function getPackagesByName(packageNames: string[]): Promise<NpmSearchResponse> {
    if (packageNames.length === 0) {
      return { isStale: false, objects: [], total: 0, time: new Date().toISOString() }
    }

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

  /**
   * Combined search + org/user/package existence checks in a single
   * Algolia multi-search request.
   */
  async function searchWithSuggestions(
    query: string,
    options: AlgoliaSearchOptions = {},
    checks?: AlgoliaMultiSearchChecks,
  ): Promise<AlgoliaSearchWithSuggestionsResult> {
    const requests: SearchQuery[] = [
      {
        indexName,
        query,
        offset: options.from,
        length: options.size,
        filters: options.filters || '',
        analyticsTags: ['npmx.dev'],
        attributesToRetrieve: ATTRIBUTES_TO_RETRIEVE,
        attributesToHighlight: [],
      },
    ]

    const orgQueryIndex = checks?.checkOrg && checks.name ? requests.length : -1
    if (checks?.checkOrg && checks.name) {
      requests.push({
        indexName,
        query: `"@${checks.name}"`,
        length: 1,
        analyticsTags: ['npmx.dev'],
        attributesToRetrieve: EXISTENCE_CHECK_ATTRS,
        attributesToHighlight: [],
      })
    }

    const userQueryIndex = checks?.checkUser && checks.name ? requests.length : -1
    if (checks?.checkUser && checks.name) {
      requests.push({
        indexName,
        query: '',
        filters: `owner.name:${checks.name}`,
        length: 1,
        analyticsTags: ['npmx.dev'],
        attributesToRetrieve: EXISTENCE_CHECK_ATTRS,
        attributesToHighlight: [],
      })
    }

    const packageQueryIndex = checks?.checkPackage ? requests.length : -1
    if (checks?.checkPackage) {
      requests.push({
        indexName,
        query: '',
        filters: `objectID:${checks.checkPackage}`,
        length: 1,
        analyticsTags: ['npmx.dev'],
        attributesToRetrieve: EXISTENCE_CHECK_ATTRS,
        attributesToHighlight: [],
      })
    }

    const { results } = await client.search({ requests })

    const mainResponse = results[0] as SearchResponse<AlgoliaHit> | undefined
    if (!mainResponse) {
      throw new Error('Algolia returned an empty response')
    }

    const searchResult: NpmSearchResponse = {
      isStale: false,
      objects: mainResponse.hits.map(hitToSearchResult),
      total: mainResponse.nbHits ?? 0,
      time: new Date().toISOString(),
    }

    let orgExists = false
    if (orgQueryIndex >= 0 && checks?.name) {
      const orgResponse = results[orgQueryIndex] as SearchResponse<AlgoliaHit> | undefined
      const scopePrefix = `@${checks.name.toLowerCase()}/`
      orgExists =
        orgResponse?.hits?.some(h => h.name?.toLowerCase().startsWith(scopePrefix)) ?? false
    }

    let userExists = false
    if (userQueryIndex >= 0) {
      const userResponse = results[userQueryIndex] as SearchResponse<AlgoliaHit> | undefined
      userExists = (userResponse?.nbHits ?? 0) > 0
    }

    let packageExists: boolean | null = null
    if (packageQueryIndex >= 0) {
      const pkgResponse = results[packageQueryIndex] as SearchResponse<AlgoliaHit> | undefined
      packageExists = (pkgResponse?.nbHits ?? 0) > 0
    }

    return { search: searchResult, orgExists, userExists, packageExists }
  }

  return {
    search,
    searchWithSuggestions,
    searchByOwner,
    getPackagesByName,
  }
}
