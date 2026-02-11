export interface UserServerSession {
  public?:
    | {
        did: string
        handle: string
        pds: string
        avatar?: string
      }
    | undefined
  // These values are tied to the users browser session and used by atproto OAuth
  oauthSessionId?: string | undefined
  oauthStateId?: string | undefined
}
