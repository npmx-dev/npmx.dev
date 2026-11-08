/**
 * GET /api/social/collections/:identifier
 *
 * Lists a user's collections, newest first, straight from their PDS.
 */
export default defineEventHandler(async event => {
  const identifier = getRouterParam(event, 'identifier')!
  const { cursor, limit } = getPaginationQuery(event)

  try {
    return await new CollectionsUtils().listUserCollections(identifier, limit, cursor)
  } catch (error: unknown) {
    handleApiError(error, { statusCode: 502, message: 'Failed to list collections' })
  }
})
