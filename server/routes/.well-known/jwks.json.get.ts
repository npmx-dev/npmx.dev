import { loadJWKs } from '#server/utils/atproto/oauth'

export default defineEventHandler(async _ => {
  const keys = await loadJWKs()
  if (!keys) {
    console.error('Failed to load JWKs. May not be set')
    return []
  }

  return keys.publicJwks
})
