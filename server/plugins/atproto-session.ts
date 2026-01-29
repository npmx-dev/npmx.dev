import type { H3Event } from 'h3'
import { getOauthClientMetadata } from '#server/utils/atproto'
import type { OAuthSession } from '@atproto/oauth-client-node'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { SessionStore, StateStore } from '#server/api/auth/atproto.get'

/**
 * Server middleware that attaches an atproto oauth session to the event context if a user is logged in.
 * This allows app composables to access atproto clients
 */
export default defineNitroPlugin(nitroApp => {
  const getOAuthSession = async (event: H3Event) => {
    const clientMetadata = getOauthClientMetadata()
    const stateStore = new StateStore(event)
    const sessionStore = new SessionStore(event)
    const client = new NodeOAuthClient({
      stateStore,
      sessionStore,
      clientMetadata,
    })
    const currentSession = await sessionStore.get()
    if (currentSession) {
      //TODO may be better to grab the session key from cookie or abstract that way some to share code
      return await client.restore(currentSession.tokenSet.sub)
    }
    return undefined
  }

  // Attach to event context for access in composables via useRequestEvent()
  nitroApp.hooks.hook('request', event => {
    event.context.getOAuthSession = () => getOAuthSession(event)
  })
})

export type GetOAuthSession = () => Promise<OAuthSession | undefined>

// Extend the H3EventContext type
declare module 'h3' {
  interface H3EventContext {
    getOAuthSession: GetOAuthSession
  }
}
