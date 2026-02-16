import type { NodeSavedSession } from '@atproto/oauth-client-node'

export interface UserServerSession {
  public?:
    | {
        did: string
        handle: string
        pds: string
        avatar?: string
        relogin?: boolean
      }
    | undefined

  // DO NOT USE
  // Here for historic reasons to redirect users logged in with the previous oauth to login again
  oauthSession?: NodeSavedSession | undefined
}
