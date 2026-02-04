import type { NodeSavedSession, NodeSavedSessionStore } from '@atproto/oauth-client-node'
import type { UserServerSession } from '#shared/types/userSession'
import type { SessionManager } from 'h3'

export class OAuthSessionStore implements NodeSavedSessionStore {
  private readonly session: SessionManager<UserServerSession>

  constructor(session: SessionManager<UserServerSession>) {
    this.session = session
  }

  async get(): Promise<NodeSavedSession | undefined> {
    const sessionData = this.session.data
    if (!sessionData) return undefined
    return sessionData.oauthSession
  }

  async set(_key: string, val: NodeSavedSession) {
    // We are ignoring the key since the mapping is already done in the session
    await this.session.update({
      oauthSession: val,
    })
  }

  async del() {
    await this.session.update({
      oauthSession: undefined,
    })
  }
}
