import { loadJWKs } from '#server/utils/atproto/oauth'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  const keys = await loadJWKs(config)
  if (!keys) {
    console.error('Failed to load JWKs. May not be set')
    return []
  }

  return keys.publicJwks
})
