/**
 * Embedding of the downloads trends chart (single package via ChartModal, or multiple via compare)
 * A static svg is generated from the endpoint.
 */

import { createDownloadsSvgResponse } from '~~/server/utils/embed-downloads-svg'

export default defineCachedEventHandler(
  async event => {
    const svg = await createDownloadsSvgResponse(getQuery(event))

    setHeader(event, 'Content-Type', 'image/svg+xml; charset=utf-8')
    setHeader(event, 'Cache-Control', 'public, max-age=3600, s-maxage=86400')

    return svg
  },
  {
    maxAge: 60 * 60,
    swr: true,
    getKey: event => event.node.req.url || event.path,
  },
)
