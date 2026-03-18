import type { NodeOAuthClient } from '@atproto/oauth-client-node'

/**
 * Creates a long living instance of the NodeOAuthClient.
 */
export default defineNitroPlugin(async nitroApp => {
  const oauthClient = await getNodeOAuthClient()

  // Attach to event context for access in composables via useRequestEvent()
  nitroApp.hooks.hook('request', event => {
    event.context.oauthClient = oauthClient
  })
})

// Extend the H3EventContext type
declare module 'h3' {
  interface H3EventContext {
    oauthClient: NodeOAuthClient
  }
}
