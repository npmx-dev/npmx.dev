import type { NodeSavedSession, NodeSavedSessionStore } from '@atproto/oauth-client-node'
import type { UserServerSession } from '#shared/types/userSession'
import type { SessionManager } from 'h3'
import { OAUTH_CACHE_STORAGE_BASE } from '#server/utils/atproto/storage'

export class OAuthSessionStore implements NodeSavedSessionStore {
  private readonly serverSession: SessionManager<UserServerSession>
  private readonly storage = useStorage(OAUTH_CACHE_STORAGE_BASE)

  constructor(session: SessionManager<UserServerSession>) {
    this.serverSession = this.serverSession = session
  }

  private createStorageKey(did: string, sessionId: string) {
    return `sessions:${did}:${sessionId}`
  }

  async get(key: string): Promise<NodeSavedSession | undefined> {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    if (!serverSessionData.oauthSessionId) {
      console.warn('[oauth session store] No oauthSessionId found in session data')
      return undefined
    }

    let session = await this.storage.getItem<NodeSavedSession>(
      this.createStorageKey(key, serverSessionData.oauthSessionId),
    )
    return session ?? undefined
  }

  async set(key: string, val: NodeSavedSession) {
    const serverSessionData = this.serverSession.data
    let sessionId
    if (!serverSessionData.oauthSessionId) {
      sessionId = crypto.randomUUID()
      await this.serverSession.update({
        oauthSessionId: sessionId,
      })
    } else {
      sessionId = serverSessionData.oauthSessionId
    }
    try {
      await this.storage.setItem<NodeSavedSession>(this.createStorageKey(key, sessionId), val)
    } catch (error) {
      // Not sure if this has been happening. But helps with debugging
      console.error(
        '[oauth session store] Failed to set session:',
        error instanceof Error ? error.message : 'Unknown error',
      )
      throw error
    }
  }

  async del(key: string) {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    if (!serverSessionData.oauthSessionId) {
      console.warn('[oauth session store] No oauthSessionId found in session data')
      return undefined
    }
    await this.storage.removeItem(this.createStorageKey(key, serverSessionData.oauthSessionId))
    await this.serverSession.update({
      oauthSessionId: undefined,
    })
  }
}
