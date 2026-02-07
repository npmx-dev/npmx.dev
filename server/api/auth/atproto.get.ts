import { Agent } from '@atproto/api'
import { NodeOAuthClient } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect } from 'h3'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { SLINGSHOT_HOST } from '#shared/utils/constants'
import { useServerSession } from '#server/utils/server-session'
import type { PublicUserSession } from '#shared/schemas/publicUserSession'
import { handleResolver } from '#server/utils/atproto/oauth'
import { Client } from '@atproto/lex'
import * as app from '#shared/types/lexicons/app'
import { ensureValidAtIdentifier } from '@atproto/syntax'
// @ts-expect-error virtual file from oauth module
import { clientUri } from '#oauth/config'

/**
 * Fetch the user's profile record to get their avatar blob reference
 * @param did
 * @param pds
 * @returns
 */
async function getAvatar(did: string, pds: string) {
  let avatar: string | undefined
  try {
    const pdsUrl = new URL(pds)
    // Only fetch from HTTPS PDS endpoints to prevent SSRF
    if (did && pdsUrl.protocol === 'https:') {
      ensureValidAtIdentifier(did)
      const client = new Client(pdsUrl)
      const profileResponse = await client.get(app.bsky.actor.profile, {
        repo: did,
        rkey: 'self',
      })

      const validatedResponse = app.bsky.actor.profile.main.validate(profileResponse.value)

      if (validatedResponse.avatar?.ref) {
        // Use Bluesky CDN for faster image loading
        avatar = `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${validatedResponse.avatar?.ref}@jpeg`
      }
    }
  } catch {
    // Avatar fetch failed, continue without it
  }
  return avatar
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
    handleResolver,
  })

  if (!query.code) {
    // Validate returnTo is a safe relative path (prevent open redirect)
    // Only set cookie on initial auth request, not the callback
    let redirectPath = '/'
    try {
      const clientOrigin = new URL(clientUri).origin
      const returnToUrl = new URL(query.returnTo?.toString() || '/', clientUri)
      if (returnToUrl.origin === clientOrigin) {
        redirectPath = returnToUrl.pathname + returnToUrl.search + returnToUrl.hash
      }
    } catch {
      // Invalid URL, fall back to root
    }

    setCookie(event, 'auth_return_to', redirectPath, {
      maxAge: 60 * 5,
      httpOnly: true,
      // secure only if NOT in dev mode
      secure: !import.meta.dev,
    })
    try {
      const handle = query.handle?.toString()
      const create = query.create?.toString()

      if (!handle) {
        throw createError({
          statusCode: 401,
          message: 'Handle not provided in query',
        })
      }

      const redirectUrl = await atclient.authorize(handle, {
        scope,
        prompt: create ? 'create' : undefined,
      })
      return sendRedirect(event, redirectUrl.toString())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Authentication failed.'

      return handleApiError(error, {
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: `${message}. Please login and try again.`,
      })
    }
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

    let avatar: string | undefined = await getAvatar(authSession.did, miniDoc.pds)

    await session.update({
      public: {
        ...miniDoc,
        avatar,
      },
    })
  } else {
    //If slingshot fails we still want to set some key info we need.
    const pdsBase = (await authSession.getTokenInfo()).aud
    let avatar: string | undefined = await getAvatar(authSession.did, pdsBase)
    await session.update({
      public: {
        did: authSession.did,
        handle: 'Not available',
        pds: pdsBase,
        avatar,
      },
    })
  }

  const returnToURL = getCookie(event, 'auth_return_to') || '/'
  deleteCookie(event, 'auth_return_to')

  return sendRedirect(event, returnToURL)
})
