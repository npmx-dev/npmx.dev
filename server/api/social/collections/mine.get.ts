/**
 * GET /api/social/collections/mine
 *
 * The logged-in user's collections with their items, for adding packages to them.
 */
export default eventHandlerWithOAuthSession(async (_event, session) => {
  const { did } = requireOAuthSession(session)
  try {
    return await new CollectionsUtils().listOwnCollections(did)
  } catch (error: unknown) {
    handleApiError(error, { statusCode: 502, message: 'Failed to list your collections' })
  }
})
