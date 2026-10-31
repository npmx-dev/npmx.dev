import { getOauthClientMetadata, loadJWKs } from '#server/utils/atproto/oauth'
import { defineEventHandler } from 'nuxt/server'
export default defineEventHandler(async () => {
  const keyset = await loadJWKs()
  const pk = keyset?.findPrivateKey({ usage: 'sign' })
  return getOauthClientMetadata(pk?.alg)
})
