import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node'
import { OAUTH_CACHE_STORAGE_BASE } from './storage'

// It is recommended that oauth state is only saved for 30 minutes
const STATE_EXPIRATION = CACHE_MAX_AGE_ONE_MINUTE * 30

export class OAuthStateStore implements NodeSavedStateStore {
  private readonly cache: CacheAdapter

  constructor() {
    this.cache = getCacheAdapter(OAUTH_CACHE_STORAGE_BASE)
  }

  private createStorageKey(key: string) {
    return `state:${key}`
  }

  async get(key: string): Promise<NodeSavedState | undefined> {
    const state = await this.cache.get<NodeSavedState>(this.createStorageKey(key))
    return state ?? undefined
  }

  async set(key: string, val: NodeSavedState) {
    await this.cache.set<NodeSavedState>(this.createStorageKey(key), val, STATE_EXPIRATION)
  }

  async del(key: string) {
    await this.cache.delete(this.createStorageKey(key))
  }
}
