export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const keyset = await loadJWKs(config)
  // @ts-expect-error Taken from statusphere-example-app. Throws a ts error
  const pk = keyset?.findPrivateKey({ use: 'sig' })
  return getOauthClientMetadata(pk?.alg)
})
