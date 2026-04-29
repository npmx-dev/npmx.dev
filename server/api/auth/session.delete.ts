export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  // Even though the signOut also clears part of the server cache, this should be done in order
  // to let the OAuth package do any other clean up it may need
  await oAuthSession?.signOut()
  await serverSession.clear()
  return 'Session cleared'
})
