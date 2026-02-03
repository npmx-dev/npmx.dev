import { Agent } from '@atproto/api'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect } from 'h3'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { SLINGSHOT_HOST } from '#shared/utils/constants'
import { useServerSession } from '#server/utils/server-session'
import type { PublicUserSession } from '#shared/schemas/publicUserSession'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  if (!config.sessionPassword) {
    throw createError({
      status: 500,
      message: UNSET_NUXT_SESSION_PASSWORD,
    })
  }

  const query = getQuery(event)
  const clientMetadata = getOauthClientMetadata()
  const session = await useServerSession(event)
  const { stateStore, sessionStore } = useOAuthStorage(session)

  const atclient = new NodeOAuthClient({
    stateStore,
    sessionStore,
    clientMetadata,
    requestLock: getOAuthLock(),
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

  const response = await fetch(
    `https://${SLINGSHOT_HOST}/xrpc/com.bad-example.identity.resolveMiniDoc?identifier=${agent.did}`,
    { headers: { 'User-Agent': 'npmx' } },
  )
  if (response.ok) {
    const miniDoc: PublicUserSession = await response.json()
    await session.update({
      public: miniDoc,
    })
  }

  return sendRedirect(event, '/')
})
