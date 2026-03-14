import { Agent } from '@atproto/api'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  if (!oAuthSession) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const agent = new Agent(oAuthSession)
  try {
    await agent.com.atproto.server.requestEmailUpdate()
    return { success: true }
  } catch (err: any) {
    throw createError({ statusCode: 500, statusMessage: err.message })
  }
})
