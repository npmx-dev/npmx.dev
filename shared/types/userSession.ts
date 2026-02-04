import type { NodeSavedSession, NodeSavedState } from '@atproto/oauth-client-node'

export interface UserServerSession {
  public: {
    did: string
    handle: string
    pds: string
    avatar?: string
  }
  // Only to be used in the atproto session and state stores
  // Will need to change to Record<string, T> and add a current logged in user if we ever want to support
  // multiple did logins per server session
  oauthSession: NodeSavedSession | undefined
  oauthState: NodeSavedState | undefined
}
