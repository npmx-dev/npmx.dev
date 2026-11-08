/**
 * GET /api/social/profile/:identifier/followed-collections
 *
 * Collections the account follows, newest follow first, from its PDS. A page can come back
 * shorter than `limit` when followed collections were deleted or hidden.
 */
export default defineEventHandler(async event => {
  const identifier = getRouterParam(event, 'identifier')!
  const { cursor, limit } = getPaginationQuery(event)

  try {
    return await new CollectionsUtils().listFollowedCollections(identifier, limit, cursor)
  } catch (error: unknown) {
    handleApiError(error, { statusCode: 502, message: 'Failed to list followed collections' })
  }
})
