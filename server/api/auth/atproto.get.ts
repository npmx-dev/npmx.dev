import type { OAuthSession } from '@atproto/oauth-client-node'
import { NodeOAuthClient, OAuthCallbackError } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect, setCookie, getCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'
import { getOAuthLock } from '#server/utils/atproto/lock'
import { useOAuthStorage } from '#server/utils/atproto/storage'
import { SLINGSHOT_HOST } from '#shared/utils/constants'
import { useServerSession } from '#server/utils/server-session'
import { handleResolver } from '#server/utils/atproto/oauth'
import { handleApiError } from '#server/utils/error-handler'
import type { DidString } from '@atproto/lex'
import { Client } from '@atproto/lex'
import * as com from '#shared/types/lexicons/com'
import * as app from '#shared/types/lexicons/app'
import { isAtIdentifierString } from '@atproto/lex'
import { scope, getOauthClientMetadata } from '#server/utils/atproto/oauth'
import { UNSET_NUXT_SESSION_PASSWORD } from '#shared/utils/constants'
// @ts-expect-error virtual file from oauth module
import { clientUri } from '#oauth/config'

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

  if (query.handle) {
    // Initiate auth flow
    if (
      typeof query.handle !== 'string' ||
      (!query.handle.startsWith('https://') && !isAtIdentifierString(query.handle))
    ) {
      throw createError({
        statusCode: 400,
        message: 'Invalid handle parameter',
      })
    }

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

    try {
      const redirectUrl = await atclient.authorize(query.handle, {
        scope,
        prompt: query.create ? 'create' : undefined,
        ui_locales: query.locale?.toString(),
        state: encodeOAuthState(event, { redirectPath }),
      })

      return sendRedirect(event, redirectUrl.toString())
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initiate authentication.'

      return handleApiError(error, {
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: `${message}. Please login and try again.`,
      })
    }
  } else {
    // Handle callback
    try {
      const params = new URLSearchParams(query as Record<string, string>)
      const result = await atclient.callback(params)
      try {
        const state = decodeOAuthState(event, result.state)
        const profile = await getMiniProfile(result.session)

        await session.update({ public: profile })
        return sendRedirect(event, state.redirectPath)
      } catch (error) {
        // If we are unable to cleanly handle the callback, meaning that the
        // user won't be able to use the session, we sign them out of the
        // session to prevent dangling sessions. This can happen if the state is
        // invalid (e.g. user has cookies disabled, or the state expired) or if
        // there is an issue fetching the user's profile after authentication.
        await result.session.signOut()
        throw error
      }
    } catch (error) {
      // user cancelled explicitly
      if (query.error === 'access_denied' && error instanceof OAuthCallbackError && error.state) {
        const state = decodeOAuthState(event, error.state)
        return sendRedirect(event, state.redirectPath)
      }

      const message = error instanceof Error ? error.message : 'Authentication failed.'
      return handleApiError(error, {
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message: `${message}. Please login and try again.`,
      })
    }
  }
})

type OAuthStateData = {
  redirectPath: string
}

const SID_COOKIE_PREFIX = 'atproto_oauth_sid'
const SID_COOKIE_VALUE = '1'

/**
 * This function encodes the OAuth state by generating a random SID, storing it
 * in a cookie, and returning a JSON string containing the original state and
 * the SID. The cookie is used to validate the authenticity of the callback
 * request later.
 *
 * This mechanism allows to bind a particular authentication request to a
 * particular client (browser) session, providing protection against CSRF attacks
 * and ensuring that the callback is part of an ongoing authentication flow
 * initiated by the same client.
 *
 * Note that this mechanism could use any other unique session mechanism the
 * server has with the client (e.g. UserServerSession). We don't do that though
 * to avoid polluting the session with ephemeral OAuth-specific data.
 *
 * @param event The H3 event object, used to set the cookie
 * @param state The original OAuth state to encode
 * @returns A JSON string encapsulating the original state and the generated SID
 */
function encodeOAuthState(event: H3Event, data: OAuthStateData): string {
  const sid = generateRandomHexString()
  setCookie(event, `${SID_COOKIE_PREFIX}_${sid}`, SID_COOKIE_VALUE, {
    maxAge: 60 * 5,
    httpOnly: true,
    // secure only if NOT in dev mode
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: event.path,
  })
  return JSON.stringify({ data, sid })
}

function generateRandomHexString(byteLength: number = 16): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(byteLength)), byte =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

/**
 * This function ensures that an oauth state was indeed encoded for the browser
 * session performing the oauth callback.
 *
 * @param event The H3 event object, used to read and delete the cookie
 * @param state The JSON string containing the original state and SID
 * @returns The original OAuth state if the SID is valid
 * @throws An error if the SID is missing or invalid, indicating a potential issue with cookies or expired state
 */
function decodeOAuthState(event: H3Event, state: string | null): OAuthStateData {
  if (!state) {
    // May happen during transition period (if a user initiated auth flow before
    // the release with the new state handling, then tries to complete it after
    // the release).
    throw createError({
      statusCode: 400,
      message: 'Missing state parameter',
    })
  }

  // The state sting was encoded using encodeOAuthState. No need to protect
  // against JSON parsing since the StateStore should ensure it's integrity.
  const decoded = JSON.parse(state) as { data: OAuthStateData; sid: string }

  const sid = getCookie(event, `${SID_COOKIE_PREFIX}_${decoded.sid}`)
  if (sid === SID_COOKIE_VALUE) {
    deleteCookie(event, `${SID_COOKIE_PREFIX}_${decoded.sid}`, {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'lax',
      path: event.path,
    })
  } else {
    throw createError({
      statusCode: 400,
      message: 'Missing authentication state. Please enable cookies and try again.',
    })
  }

  return decoded.data
}

/**
 * Fetches the mini profile for the authenticated user, including their avatar if available.
 * This is used to populate the session with basic user info after authentication.
 * @param authSession The OAuth session containing the user's DID and token info
 * @returns An object containing the user's DID, handle, PDS, and avatar URL (if available)
 */
async function getMiniProfile(authSession: OAuthSession) {
  const client = new Client({ service: `https://${SLINGSHOT_HOST}` })
  const response = await client.xrpcSafe(com['bad-example'].identity.resolveMiniDoc, {
    headers: { 'User-Agent': 'npmx' },
    params: { identifier: authSession.did },
  })

  if (response.success) {
    const miniDoc = response.body

    let avatar: string | undefined = await getAvatar(authSession.did, miniDoc.pds)

    return {
      ...miniDoc,
      avatar,
    }
  } else {
    //If slingshot fails we still want to set some key info we need.
    const pdsBase = (await authSession.getTokenInfo()).aud
    let avatar: string | undefined = await getAvatar(authSession.did, pdsBase)
    return {
      did: authSession.did,
      handle: 'Not available',
      pds: pdsBase,
      avatar,
    }
  }
}

/**
 * Fetch the user's profile record to get their avatar blob reference
 * @param did
 * @param pds
 * @returns
 */
async function getAvatar(did: DidString, pds: string) {
  let avatar: string | undefined
  try {
    const pdsUrl = new URL(pds)
    // Only fetch from HTTPS PDS endpoints to prevent SSRF
    if (pdsUrl.protocol === 'https:') {
      const client = new Client(pdsUrl)
      const profileResponse = await client.get(app.bsky.actor.profile, {
        repo: did,
        rkey: 'self',
      })

      const validatedResponse = app.bsky.actor.profile.main.validate(profileResponse.value)
      const cid = validatedResponse.avatar?.ref

      if (cid) {
        // Use Bluesky CDN for faster image loading
        avatar = `https://cdn.bsky.app/img/feed_thumbnail/plain/${did}/${cid}@jpeg`
      }
    }
  } catch {
    // Avatar fetch failed, continue without it
  }
  return avatar
}
