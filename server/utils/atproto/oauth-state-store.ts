import type { NodeSavedState, NodeSavedStateStore } from '@atproto/oauth-client-node'
import type { UserServerSession } from '#shared/types/userSession'
import type { SessionManager } from 'h3'

export class OAuthStateStore implements NodeSavedStateStore {
  private readonly session: SessionManager<UserServerSession>

  constructor(session: SessionManager<UserServerSession>) {
    this.session = session
  }

  async get(): Promise<NodeSavedState | undefined> {
    const sessionData = this.session.data
    if (!sessionData) return undefined
    return sessionData.oauthState
  }

  async set(_key: string, val: NodeSavedState) {
    // We are ignoring the key since the mapping is already done in the session
    await this.session.update({
      oauthState: val,
    })
  }

  async del() {
    await this.session.update({
      oauthState: undefined,
    })
  }
}
