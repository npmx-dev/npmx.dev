import type { AppSettings } from '#shared/schemas/app-settings'

export default defineEventHandler(async event => {
  // Current thinking is reads can just be a normal event handler and writes use the oauth
  const serverSession = await useServerSession(event)

  const storage = useStorage('atproto:generic')
  const storageKey = `settings:${serverSession.data.public.did}`
  return storage.getItem<AppSettings>(storageKey)
})
