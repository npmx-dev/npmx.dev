import { Agent } from '@atproto/api'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  if (!oAuthSession) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const agent = new Agent(oAuthSession)

  try {
    const response = await agent.com.atproto.server.describeServer()
    return response.data.availableUserDomains
  } catch (err: any) {
    throw createError({
      statusCode: 500,
      statusMessage: err.message || 'Failed to fetch server info.',
    })
  }
})
