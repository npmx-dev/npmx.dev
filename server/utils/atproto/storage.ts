import type {
  NodeSavedSession,
  NodeSavedSessionStore,
  NodeSavedState,
  NodeSavedStateStore,
} from '@atproto/oauth-client-node'
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

/**
 * Storage key prefix for oauth session storage.
 */
export const OAUTH_SESSION_CACHE_STORAGE_BASE = 'oauth-atproto-session'

export class OAuthSessionStore implements NodeSavedSessionStore {
  // TODO: not sure if we will support multi accounts, but if we do in the future will need to change this around
  private readonly cookieKey = 'oauth:atproto:session'
  private readonly storage = useStorage(OAUTH_SESSION_CACHE_STORAGE_BASE)

  constructor(private event: H3Event) {}

  async get(): Promise<NodeSavedSession | undefined> {
    const sessionKey = getCookie(this.event, this.cookieKey)
    if (!sessionKey) return
    const result = await this.storage.getItem<NodeSavedSession>(sessionKey)
    if (!result) return
    return result
  }

  async set(key: string, val: NodeSavedSession) {
    setCookie(this.event, this.cookieKey, key, {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'lax',
    })
    await this.storage.setItem<NodeSavedSession>(key, val)
  }

  async del() {
    const sessionKey = getCookie(this.event, this.cookieKey)
    if (sessionKey) {
      await this.storage.del(sessionKey)
    }
    deleteCookie(this.event, this.cookieKey)
  }
}

export const useOAuthStorage = (event: H3Event) => {
  return {
    stateStore: new OAuthStateStore(event),
    sessionStore: new OAuthSessionStore(event),
  }
}
