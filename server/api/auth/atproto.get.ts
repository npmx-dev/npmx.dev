import { Agent } from '@atproto/api'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect } from 'h3'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { SLINGSHOT_HOST } from '#shared/utils/constants'
import type { UserSession } from '#shared/schemas/userSession'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  if (!config.sessionPassword) {
    throw createError({
      status: 500,
      message: 'NUXT_SESSION_PASSWORD not set',
    })
  }

  const query = getQuery(event)
  const clientMetadata = getOauthClientMetadata()
  const { stateStore, sessionStore } = useOAuthStorage(event)

  const atclient = new NodeOAuthClient({
    stateStore,
    sessionStore,
    clientMetadata,
  })

  if (!query.code) {
    const handle = query.handle?.toString()
    const create = query.create?.toString()

    if (!handle) {
      throw createError({
        status: 400,
        message: 'Handle not provided in query',
      })
    }

    const redirectUrl = await atclient.authorize(handle, {
      scope,
      prompt: create ? 'create' : undefined,
    })
    return sendRedirect(event, redirectUrl.toString())
  }

  const { session: authSession } = await atclient.callback(
    new URLSearchParams(query as Record<string, string>),
  )
  const agent = new Agent(authSession)
  event.context.agent = agent

  const session = await useSession(event, {
    password: config.sessionPassword,
  })

  const response = await fetch(
    `https://${SLINGSHOT_HOST}/xrpc/com.bad-example.identity.resolveMiniDoc?identifier=${agent.did}`,
    { headers: { 'User-Agent': 'npmx' } },
  )
  const miniDoc = (await response.json()) as UserSession

  await session.update(miniDoc)

  return sendRedirect(event, '/')
})
