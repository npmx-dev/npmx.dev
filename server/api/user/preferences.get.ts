import { safeParse } from 'valibot'
import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { useUserPreferencesStore } from '#server/utils/preferences/user-preferences-store'

export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  const session = safeParse(PublicUserSessionSchema, serverSession.data.public)
  if (!session.success) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const preferences = await useUserPreferencesStore().get(session.output.did)

  // Return null when no stored preferences exist (first-time user).
  // This lets the client distinguish "no server prefs" from "user has default prefs"
  // so that anonymous localStorage customizations can be preserved on first login.
  return preferences
})
