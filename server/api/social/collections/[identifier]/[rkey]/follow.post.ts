/**
 * POST /api/social/collections/:identifier/:rkey/follow
 */
export default eventHandlerWithOAuthSession((event, session) =>
  setReaction(session, getCollectionRouteParams(event), 'follow', true),
)
