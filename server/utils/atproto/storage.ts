import type { H3Event } from 'h3'
import { OAuthStateStore } from './oauth-state-store'
import { OAuthSessionStore } from './oauth-session-store'

export const useOAuthStorage = (event: H3Event) => {
  return {
    stateStore: new OAuthStateStore(event),
    sessionStore: new OAuthSessionStore(event),
  }
}
