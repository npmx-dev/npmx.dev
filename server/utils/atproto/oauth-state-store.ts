import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node'
import type { UserServerSession } from '#shared/types/userSession'
import type { SessionManager } from 'h3'

// It is recommended that oauth state is only saved for 30 minutes
const STATE_EXPIRATION = CACHE_MAX_AGE_ONE_MINUTE * 30

export class OAuthStateStore implements NodeSavedStateStore {
  private readonly serverSession: SessionManager<UserServerSession>
  private readonly cache: CacheAdapter

  constructor(session: SessionManager<UserServerSession>) {
    this.serverSession = session
    this.cache = getCacheAdapter(OAUTH_CACHE_STORAGE_BASE)
  }

  private createStorageKey(did: string, sessionId: string) {
    return `state:${did}:${sessionId}`
  }

  async get(key: string): Promise<NodeSavedState | undefined> {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    if (!serverSessionData.oauthStateId) return undefined
    const state = await this.cache.get<NodeSavedState>(
      this.createStorageKey(key, serverSessionData.oauthStateId),
    )
    return state ?? undefined
  }

  async set(key: string, val: NodeSavedState) {
    let stateId = crypto.randomUUID()
    await this.serverSession.update({
      oauthStateId: stateId,
    })
    await this.cache.set<NodeSavedState>(this.createStorageKey(key, stateId), val, STATE_EXPIRATION)
  }

  async del(key: string) {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    if (!serverSessionData.oauthStateId) return undefined
    await this.cache.delete(this.createStorageKey(key, serverSessionData.oauthStateId))
    await this.serverSession.update({
      oauthStateId: undefined,
    })
  }
}
