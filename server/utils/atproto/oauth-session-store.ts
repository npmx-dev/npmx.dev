import type { NodeSavedSession, NodeSavedSessionStore } from '@atproto/oauth-client-node'
import { OAUTH_CACHE_STORAGE_BASE } from '#server/utils/atproto/storage'

// Refresh tokens from a confidential client should last for 180 days, each new refresh of access token resets
// the expiration with the new refresh token. Shorting to 179 days to keep it a bit simpler since we rely on redis to clear sessions
// Note: This expiration only lasts this long in production. Local dev is 2 weeks
const SESSION_EXPIRATION = CACHE_MAX_AGE_ONE_DAY * 179

export class OAuthSessionStore implements NodeSavedSessionStore {
  private readonly cache: CacheAdapter

  constructor() {
    this.cache = getCacheAdapter(OAUTH_CACHE_STORAGE_BASE)
  }

  private createStorageKey(did: string) {
    return `sessions:${did}`
  }

  async get(key: string): Promise<NodeSavedSession | undefined> {
    let session = await this.cache.get<NodeSavedSession>(this.createStorageKey(key))
    return session ?? undefined
  }

  async set(key: string, val: NodeSavedSession) {
    await this.cache.set<NodeSavedSession>(this.createStorageKey(key), val, SESSION_EXPIRATION)
  }

  async del(key: string) {
    await this.cache.delete(this.createStorageKey(key))
  }
}
