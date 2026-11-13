import type { BrowseSort } from '#server/utils/atproto/utils/collections-index'

/**
 * GET /api/social/collections/browse?sort=recent|liked|followed&cursor=&limit=
 *
 * Collections across the network, from the Jetstream index. `cursor` is an offset.
 */
export default defineEventHandler(async event => {
  const query = getQuery(event)
  const sort: BrowseSort =
    query.sort === 'liked' || query.sort === 'followed' ? query.sort : 'recent'
  const { cursor, limit } = getPaginationQuery(event, 24, 60)
  const offset = Math.max(Number.parseInt(cursor ?? '0', 10) || 0, 0)

  try {
    const { entries, scanned } = await getCollectionsIndexStore().list(sort, offset, limit)
    const items = await new CollectionsUtils().hydrate(entries, (miniDoc, entry) => ({
      ...entry,
      handle: miniDoc.handle,
    }))
    return {
      items,
      // Hidden or stale entries can shorten a page without ending it
      cursor: scanned === limit ? String(offset + limit) : undefined,
    }
  } catch (error: unknown) {
    handleApiError(error, { statusCode: 502, message: 'Failed to browse collections' })
  }
})
