import * as v from 'valibot'
import { SearchQuerySchema } from '#shared/schemas/package'
import type { NpmSearchResponse } from '#shared/types'
import {
  CACHE_MAX_AGE_ONE_MINUTE,
  ERROR_NPM_FETCH_FAILED,
  NPM_REGISTRY,
} from '#shared/utils/constants'

const DEFAULT_SEARCH_SIZE = 12
const MAX_SEARCH_SIZE = 25

function parseSearchSize(value: unknown): number {
  if (typeof value !== 'string') {
    return DEFAULT_SEARCH_SIZE
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return DEFAULT_SEARCH_SIZE
  }

  return Math.min(Math.max(parsed, 1), MAX_SEARCH_SIZE)
}

function parseSearchQuery(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function parseSearchOffset(value: unknown): number {
  if (typeof value !== 'string') {
    return 0
  }

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.max(0, parsed)
}

export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)

    try {
      const q = v.parse(SearchQuerySchema, parseSearchQuery(query.q))
      if (!q) {
        return {
          objects: [],
          total: 0,
          isStale: false,
          time: new Date().toISOString(),
        } satisfies NpmSearchResponse
      }

      const params = new URLSearchParams({
        text: q,
        size: String(parseSearchSize(query.size)),
        from: String(parseSearchOffset(query.from)),
      })

      const response = await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params}`)
      return {
        ...response,
        isStale: false,
      } satisfies NpmSearchResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_NPM_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_MINUTE,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      return `npm-search:v1:${String(query.q ?? '')}:${String(query.size ?? '')}:${String(query.from ?? '')}`
    },
  },
)
