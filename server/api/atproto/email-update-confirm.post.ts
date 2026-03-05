import { Agent } from '@atproto/api'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  if (!oAuthSession) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const body = await readBody(event)
  if (!body || !body.email || !body.token) {
    throw createError({ statusCode: 400, statusMessage: 'Email and token required' })
  }
  const agent = new Agent(oAuthSession)
  try {
    await agent.com.atproto.server.updateEmail({
      email: body.email,
      emailAuthFactor: body.token.trim(),
    })
    return { success: true }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message })
  }
})
