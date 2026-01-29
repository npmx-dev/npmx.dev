import { Agent } from '@atproto/api'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect } from 'h3'
import { OAuthSessionStore, OAuthStateStore } from '#server/utils/atproto/storage'
import { SLINGSHOT_ENDPOINT } from '#shared/utils/constants'

export default defineEventHandler(async event => {
  if (!process.env.NUXT_SESSION_PASSWORD) {
    throw createError({
      status: 500,
      message: 'NUXT_SESSION_PASSWORD not set',
    })
  }

  const query = getQuery(event)
  const clientMetadata = getOauthClientMetadata()
  const stateStore = new OAuthStateStore(event)
  const sessionStore = new OAuthSessionStore(event)
  const atclient = new NodeOAuthClient({
    stateStore,
    sessionStore,
    clientMetadata,
  })

  if (!query.code) {
    const handle = query.handle?.toString()

    if (!handle) {
      throw createError({
        status: 400,
        message: 'Handle not provided in query',
      })
    }

    const redirectUrl = await atclient.authorize(handle, { scope })
    return sendRedirect(event, redirectUrl.toString())
  }

  const { session: authSession } = await atclient.callback(
    new URLSearchParams(query as Record<string, string>),
  )
  const agent = new Agent(authSession)
  event.context.agent = agent

  const session = await useSession(event, {
    password: process.env.NUXT_SESSION_PASSWORD,
  })

  const response = await fetch(
    `${SLINGSHOT_ENDPOINT}/xrpc/com.bad-example.identity.resolveMiniDoc?identifier=${agent.did}`,
    { headers: { 'User-Agent': 'npmx' } },
  )
  const miniDoc = (await response.json()) as { did: string; handle: string; pds: string }

  await session.update({
    miniDoc,
  })

  return sendRedirect(event, '/')
})
