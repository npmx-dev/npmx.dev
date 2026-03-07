import { loadJWKs } from '#server/utils/atproto/oauth'

export default defineEventHandler(async _ => {
  const keys = await loadJWKs()
  if (!keys) {
    return []
  }

  return keys.publicJwks
})
