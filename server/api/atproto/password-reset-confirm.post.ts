import { Agent } from '@atproto/api'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  if (!oAuthSession) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody(event)
  if (!body || !body.token || !body.password) {
    throw createError({ statusCode: 400, statusMessage: 'Token and new password are required' })
  }

  const agent = new Agent(oAuthSession)

  try {
    await agent.com.atproto.server.resetPassword({
      token: body.token.trim(),
      password: body.password,
    })

    return { success: true }
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to update password. Check your code.',
    })
  }
})
