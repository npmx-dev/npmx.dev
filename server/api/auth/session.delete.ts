export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  await oAuthSession?.signOut()
  await serverSession.clear()

  return 'Session cleared'
})
