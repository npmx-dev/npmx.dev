/**
 * DELETE /api/social/collections/:identifier/:rkey/like
 */
export default eventHandlerWithOAuthSession((event, session) =>
  setReaction(session, getCollectionRouteParams(event), 'like', false),
)
