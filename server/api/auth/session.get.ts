import { UserSessionSchema } from '#shared/schemas/userSession'
import { safeParse } from 'valibot'

export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  const result = safeParse(UserSessionSchema, serverSession.data)
  if (!result.success) {
    return null
  }

  return result.output
})
