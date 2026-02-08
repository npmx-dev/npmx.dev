import { safeParse } from 'valibot'
import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { DEFAULT_USER_PREFERENCES } from '#shared/schemas/userPreferences'
import { useUserPreferencesStore } from '#server/utils/preferences/user-preferences-store'

export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  const session = safeParse(PublicUserSessionSchema, serverSession.data.public)
  if (!session.success) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const preferences = await useUserPreferencesStore().get(session.output.did)

  return preferences ?? { ...DEFAULT_USER_PREFERENCES, updatedAt: new Date().toISOString() }
})
