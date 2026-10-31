/**
 * Embedding of the downloads trends chart (single package via ChartModal, or multiple via compare)
 * A static svg is generated from the endpoint.
 */
import { createDownloadsSvgResponse } from '~~/server/utils/embed-downloads-svg'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { getQuery } from 'nuxt/server'
import { defineCachedEventHandler } from '#server/utils/cached-handler'
import { setHeader } from 'nitro/h3'

export default defineCachedEventHandler(
  async event => {
    const svg = await createDownloadsSvgResponse(getQuery(event))

    setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')
    setHeader(event, 'Access-Control-Allow-Origin', '*')

    return svg
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'embed-package-downloads',
    getKey: event => (event.url?.pathname ?? '') + (event.url?.search ?? ''),
  },
)
