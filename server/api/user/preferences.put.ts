import { safeParse } from 'valibot'
import { PublicUserSessionSchema } from '#shared/schemas/publicUserSession'
import { UserPreferencesSchema } from '#shared/schemas/userPreferences'
import { useUserPreferencesStore } from '#server/utils/preferences/user-preferences-store'

export default eventHandlerWithOAuthSession(async (event, oAuthSession, serverSession) => {
  const session = safeParse(PublicUserSessionSchema, serverSession.data.public)
  if (!session.success) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }

  const settings = safeParse(UserPreferencesSchema, await readBody(event))
  if (!settings.success) {
    throw createError({ statusCode: 400, message: 'Invalid settings format' })
  }

  await useUserPreferencesStore().set(session.output.did, settings.output)

  return { success: true }
})
