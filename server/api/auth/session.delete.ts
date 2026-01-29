export default defineEventHandler(async event => {
  const session = await useSession(event, {
    password: process.env.NUXT_SESSION_PASSWORD as string,
  })

  let oauthSession = await event.context.getOAuthSession()
  await oauthSession?.signOut()
  await session.clear()

  return 'Session cleared'
})
