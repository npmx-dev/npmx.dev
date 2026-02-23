import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { safeParse } from 'valibot'

export default eventHandlerWithOAuthSession(async (event, _, serverSession) => {
  const result = safeParse(PublicUserSessionSchema, serverSession.data.public)
  if (!result.success) {
    return null
  }

  // A one time redirect to upgrade the previous sessions.
  // Can remove in 2 weeks from merge if we'd like
  if (serverSession.data.oauthSession && serverSession.data?.public?.did) {
    await serverSession.update({
      oauthSession: undefined,
    })
    return {
      ...result.output,
      relogin: true,
    }
  }

  return result.output
})
