import type { SessionManager } from 'h3'
import { OAuthStateStore } from './oauth-state-store'
import { OAuthSessionStore } from './oauth-session-store'
import type { UserServerSession } from '#shared/types/userSession'

export const useOAuthStorage = (session: SessionManager<UserServerSession>) => {
  return {
    stateStore: new OAuthStateStore(session),
    sessionStore: new OAuthSessionStore(session),
  }
}
