/**
 * GET /api/social/collections/:identifier/:rkey
 *
 * A collection with its items resolved.
 */
export default defineEventHandler(async event => {
  const { identifier, rkey } = getCollectionRouteParams(event)

  let collection
  try {
    collection = await new CollectionsUtils().getCollection(identifier, rkey)
  } catch (error: unknown) {
    handleApiError(error, { statusCode: 502, message: 'Failed to get collection' })
  }
  if (!collection) {
    throw createError({ status: 404, message: 'Collection not found' })
  }
  return collection
})
