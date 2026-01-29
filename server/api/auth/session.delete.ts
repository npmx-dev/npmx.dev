export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  if (!process.env.NUXT_SESSION_PASSWORD) {
    throw createError({
      status: 500,
      message: 'NUXT_SESSION_PASSWORD not set',
    })
  }

  const session = await useSession(event, {
    password: process.env.NUXT_SESSION_PASSWORD,
  })

  await oAuthSession?.signOut()
  await session.clear()

  return 'Session cleared'
})
