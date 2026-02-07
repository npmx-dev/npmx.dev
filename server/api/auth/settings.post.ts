import * as v from 'valibot'
import { AppSettingsSchema } from '#shared/schemas/app-settings'
import type { AppSettings } from '#shared/schemas/app-settings'

export default eventHandlerWithOAuthSession(async (event, oauthSession) => {
  // TODO: prob find a better spot. Can't be event handler cause i need oauth on session.delete
  if (oauthSession == undefined) {
    return createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    })
  }
  const body = v.parse(AppSettingsSchema, await readBody(event))

  const storage = useStorage('atproto:generic')
  const storageKey = `settings:${oauthSession.did}`
  storage.setItem<AppSettings>(storageKey, body)
})
