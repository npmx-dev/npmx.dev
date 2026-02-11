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

  private createAKey(did: string, sessionId: string) {
    return `state:${did}:${sessionId}`
  }

  async get(): Promise<NodeSavedState | undefined> {
    const serverSessionData = this.serverSession.data
    if (!serverSessionData) return undefined
    return serverSessionData.oauthState
  }

  async set(key: string, val: NodeSavedState) {
    // We are ignoring the key since the mapping is already done in the session
    await this.serverSession.update({
      oauthState: val,
    })
  }

  async del() {
    await this.serverSession.update({
      oauthState: undefined,
    })
  }
}
