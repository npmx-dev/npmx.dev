export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  await Promise.all([oAuthSession?.signOut(), serverSession.clear()])

  return 'Session cleared'
})
