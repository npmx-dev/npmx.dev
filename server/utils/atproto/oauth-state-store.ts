import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node'
import type { H3Event } from 'h3'

/**
 * Storage key prefix for oauth state storage.
 */
export const OAUTH_STATE_CACHE_STORAGE_BASE = 'oauth-atproto-state'

export class OAuthStateStore implements NodeSavedStateStore {
  private readonly cookieKey = 'oauth:atproto:state'
  private readonly storage = useStorage(OAUTH_STATE_CACHE_STORAGE_BASE)

  constructor(private event: H3Event) {}

  async get(): Promise<NodeSavedState | undefined> {
    const stateKey = getCookie(this.event, this.cookieKey)
    if (!stateKey) return
    const result = await this.storage.getItem<NodeSavedState>(stateKey)
    if (!result) return
    return result
  }

  async set(key: string, val: NodeSavedState) {
    setCookie(this.event, this.cookieKey, key, {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'lax',
    })
    await this.storage.setItem<NodeSavedState>(key, val)
  }

  async del() {
    const stateKey = getCookie(this.event, this.cookieKey)
    deleteCookie(this.event, this.cookieKey)
    if (stateKey) {
      await this.storage.del(stateKey)
    }
  }
}
