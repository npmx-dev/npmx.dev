import * as v from 'valibot'
import { SearchQuerySchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_MINUTE, NPM_REGISTRY } from '#shared/utils/constants'

export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)

    try {
      const q = v.parse(SearchQuerySchema, query.q)

      if (!q) {
        return [q, []]
      }

      const params = new URLSearchParams({ text: q, size: '10' })
      const response = await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params}`)

      const suggestions = response.objects.map(obj => obj.package.name)
      return [q, suggestions]
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_SUGGESTIONS_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_MINUTE,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      const q = String(query.q || '').trim()
      return `opensearch-suggestions:${q}`
    },
  },
)
