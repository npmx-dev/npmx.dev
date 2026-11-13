/**
 * GET /api/social/collections/write-access
 *
 * 403 with ERROR_NEED_REAUTH when the session predates the collections scope, so the editor can
 * re-auth before the user writes anything.
 */
export default eventHandlerWithOAuthSession(async (_event, session) => {
  await requireCollectionWriteAccess(session)
  return { ok: true }
})
