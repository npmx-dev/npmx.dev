import * as v from 'valibot'
import { SearchQuerySchema } from '#shared/schemas/package'
import { NPM_REGISTRY } from '#shared/utils/constants'

export default defineEventHandler(async event => {
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
})
