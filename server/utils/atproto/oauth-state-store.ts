import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node'
import type { UserServerSession } from '#shared/types/userSession'
import type { SessionManager } from 'h3'
import { OAUTH_CACHE_STORAGE_BASE } from '#server/utils/atproto/storage'

export class OAuthStateStore implements NodeSavedStateStore {
  private readonly serverSession: SessionManager<UserServerSession>
  private readonly storage = useStorage(OAUTH_CACHE_STORAGE_BASE)

  constructor(session: SessionManager<UserServerSession>) {
    this.serverSession = session
  }

  private createStorageKey(did: string, sessionId: string) {
    return `state:${did}:${sessionId}`
  }

  async get(key: string): Promise<NodeSavedState | undefined> {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    if (!serverSessionData.oauthStateId) return undefined
    const state = await this.storage.getItem<NodeSavedState>(
      this.createStorageKey(key, serverSessionData.oauthStateId),
    )
    return state ?? undefined
  }

  async set(key: string, val: NodeSavedState) {
    let stateId = crypto.randomUUID()
    await this.serverSession.update({
      oauthStateId: stateId,
    })
    await this.storage.setItem<NodeSavedState>(this.createStorageKey(key, stateId), val)
  }

  async del(key: string) {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    if (!serverSessionData.oauthStateId) return undefined
    await this.storage.removeItem(this.createStorageKey(key, serverSessionData.oauthStateId))
    await this.serverSession.update({
      oauthStateId: undefined,
    })
  }
}
