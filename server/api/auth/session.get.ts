import { getCookie } from 'h3'
import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'
import { eventHandlerWithOAuthSession } from '#server/utils/atproto/oauth'
import { clearSessionHintCookie, setSessionHintCookie } from '#server/utils/server-session'
import { safeParse } from 'valibot'

export default eventHandlerWithOAuthSession(async (event, _, serverSession) => {
  const result = safeParse(PublicUserSessionSchema, serverSession?.data.public)
  if (!result.success) {
    if (serverSession) {
      await serverSession.clear()
    }
    if (getCookie(event, SESSION_HINT_COOKIE) !== undefined) {
      clearSessionHintCookie(event)
    }
    return null
  }

  if (getCookie(event, SESSION_HINT_COOKIE) !== SESSION_HINT_VALUE) {
    setSessionHintCookie(event)
  }

  // A one time redirect to upgrade the previous sessions.
  // Can remove in 2 weeks from merge if we'd like
  if (serverSession?.data.oauthSession && serverSession.data.public?.did) {
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
