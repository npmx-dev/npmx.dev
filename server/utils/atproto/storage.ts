import { OAuthStateStore } from './oauth-state-store'
import { OAuthSessionStore } from './oauth-session-store'

export const OAUTH_CACHE_STORAGE_BASE = 'atproto:oauth'

export const useOAuthStorage = () => {
  return {
    stateStore: new OAuthStateStore(),
    sessionStore: new OAuthSessionStore(),
  }
}
