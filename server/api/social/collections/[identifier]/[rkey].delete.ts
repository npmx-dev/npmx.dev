/**
 * DELETE /api/social/collections/:identifier/:rkey
 */
export default eventHandlerWithOAuthSession((event, session) =>
  deleteCollection(session, getCollectionRouteParams(event)),
)
