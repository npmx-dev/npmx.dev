import type { NodeSavedSession, NodeSavedSessionStore } from '@atproto/oauth-client-node'
import type { UserServerSession } from '#shared/types/userSession'
import type { SessionManager } from 'h3'
import { OAUTH_CACHE_STORAGE_BASE } from '#server/utils/atproto/storage'

// Refresh tokens from a confidential client should last for 180 days, each new refresh of access token resets
// the expiration with the new refresh token. Shorting to 179 days to keep it a bit simpler since we rely on redis to clear sessions
// Note: This expiration only lasts this long in production. Local dev is 2 weeks
const SESSION_EXPIRATION = CACHE_MAX_AGE_ONE_DAY * 179

export class OAuthSessionStore implements NodeSavedSessionStore {
  private readonly serverSession: SessionManager<UserServerSession>
  private readonly cache: CacheAdapter

  constructor(session: SessionManager<UserServerSession>) {
    this.serverSession = session
    this.cache = getCacheAdapter(OAUTH_CACHE_STORAGE_BASE)
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

    let session = await this.cache.get<NodeSavedSession>(
      this.createStorageKey(key, serverSessionData.oauthSessionId),
    )
    return session ?? undefined
  }

  async set(key: string, val: NodeSavedSession) {
    const serverSessionData = this.serverSession.data
    let sessionId
    if (!serverSessionData?.oauthSessionId) {
      sessionId = crypto.randomUUID()
      await this.serverSession.update({
        oauthSessionId: sessionId,
      })
    } else {
      sessionId = serverSessionData.oauthSessionId
    }
    try {
      await this.cache.set<NodeSavedSession>(
        this.createStorageKey(key, sessionId),
        val,
        SESSION_EXPIRATION,
      )
      await this.serverSession.update({
        lastUpdatedAt: new Date(),
      })
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
    await this.cache.delete(this.createStorageKey(key, serverSessionData.oauthSessionId))
    await this.serverSession.update({
      oauthSessionId: undefined,
    })
  }
}
