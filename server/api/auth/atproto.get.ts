import { Agent } from '@atproto/api'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect } from 'h3'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { SLINGSHOT_HOST } from '#shared/utils/constants'
import { useServerSession } from '#server/utils/server-session'
import type { PublicUserSession } from '#shared/schemas/publicUserSession'

interface ProfileRecord {
  avatar?: {
    $type: 'blob'
    ref: { $link: string }
    mimeType: string
    size: number
  }
}

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

    // Fetch the user's profile record to get their avatar blob reference
    let avatar: string | undefined
    const did = agent.did
    try {
      const pdsUrl = new URL(miniDoc.pds)
      // Only fetch from HTTPS PDS endpoints to prevent SSRF
      if (did && pdsUrl.protocol === 'https:') {
        const profileResponse = await fetch(
          `${pdsUrl.origin}/xrpc/com.atproto.repo.getRecord?repo=${encodeURIComponent(did)}&collection=app.bsky.actor.profile&rkey=self`,
          { headers: { 'User-Agent': 'npmx' } },
        )
        if (profileResponse.ok) {
          const record = (await profileResponse.json()) as { value: ProfileRecord }
          const avatarBlob = record.value.avatar
          if (avatarBlob?.ref?.$link) {
            // Use Bluesky CDN for faster image loading
            avatar = `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${avatarBlob.ref.$link}@jpeg`
          }
        }
      }
    } catch {
      // Avatar fetch failed, continue without it
    }

    await session.update({
      public: {
        ...miniDoc,
        avatar,
      },
    })
  }

  return sendRedirect(event, '/')
})
