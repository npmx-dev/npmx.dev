import type { NodeOAuthClient } from '@atproto/oauth-client-node'
import type { H3Event } from 'nitro/h3'
import { definePlugin } from 'nitro'
import { getNodeOAuthClient } from '#server/utils/atproto/oauth'

/**
 * Creates a long living instance of the NodeOAuthClient.
 */
export default definePlugin(async nitroApp => {
  // OAuth client initialization requires deployment URLs/secrets that are absent at build time
  if (import.meta.prerender) return

  const oauthClient = await getNodeOAuthClient()

  // Attach to event context for access in composables via useRequestEvent()
  nitroApp.hooks.hook('request', event => {
    ;(event as H3Event).context.oauthClient = oauthClient
  })
})

// Extend the H3EventContext type
declare module 'h3' {
  interface H3EventContext {
    oauthClient: NodeOAuthClient
  }
}

declare module 'nuxt/schema' {
  interface RequestEventContext {
    oauthClient: NodeOAuthClient
  }
}
