import { Agent } from '@atproto/api'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  if (!oAuthSession) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.email) {
    throw createError({ statusCode: 400, statusMessage: 'Email is required' })
  }

  const agent = new Agent(oAuthSession)

  try {
    await agent.com.atproto.server.requestPasswordReset({
      email: body.email,
    })

    return { success: true }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to request password reset.',
    })
  }
})
