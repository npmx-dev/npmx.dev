export default defineEventHandler(async event => {
  if (!process.env.NUXT_SESSION_PASSWORD) {
    throw createError({
      status: 500,
      message: 'NUXT_SESSION_PASSWORD not set',
    })
  }

  const session = await useSession(event, {
    password: process.env.NUXT_SESSION_PASSWORD,
  })

  return session.data
})
