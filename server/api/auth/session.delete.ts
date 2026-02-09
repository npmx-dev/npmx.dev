export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  // Even tho the signOut also clears part of the server cache should be done in order
  // to let the oAuth package do any other clean up it may need
  await oAuthSession?.signOut()
  await serverSession.clear()
  return 'Session cleared'
})
