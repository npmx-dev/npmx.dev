import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { safeParse } from 'valibot'

export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  const result = safeParse(PublicUserSessionSchema, serverSession.data.public)
  if (!result.success) {
    return null
  }

  if (oAuthSession) {
    let tokenInfo = await oAuthSession.getTokenInfo()
    console.log('scopes', tokenInfo.scope)

    // return null
  }

  return result.output
})
