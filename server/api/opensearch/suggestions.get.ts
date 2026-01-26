import type { NpmSearchResponse } from '#shared/types'
import { NPM_REGISTRY } from '#shared/utils/constants'

export default defineCachedEventHandler(
  async event => {
    const query = getQuery(event)
    const q = String(query.q || '').trim()

    if (!q) {
      return [q, []]
    }

    const params = new URLSearchParams({ text: q, size: '10' })
    const response = await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params}`)

    const suggestions = response.objects.map(obj => obj.package.name)
    return [q, suggestions]
  },
  {
    maxAge: 60,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      return `opensearch-suggestions:${query.q || ''}`
    },
  },
)
