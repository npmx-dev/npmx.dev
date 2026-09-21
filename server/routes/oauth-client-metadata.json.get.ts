export default defineEventHandler(async () => {
  const keyset = await loadJWKs()
  const pk = keyset?.findPrivateKey({ usage: 'sign' })
  return getOauthClientMetadata(pk?.alg)
})
