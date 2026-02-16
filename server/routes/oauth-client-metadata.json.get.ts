export default defineEventHandler(async _ => {
  const keyset = await loadJWKs()
  const pk = keyset?.findPrivateKey({ usage: 'sign' })
  return getOauthClientMetadata(pk?.alg)
})
