import type { OAuthSession } from '@atproto/oauth-client-node'
import { OAuthCallbackError } from '@atproto/oauth-client-node'
import { createError, getQuery, sendRedirect, setCookie, getCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'
import { SLINGSHOT_HOST } from '#shared/utils/constants'
import { useServerSession } from '#server/utils/server-session'
import { handleApiError } from '#server/utils/error-handler'
import type { DidString } from '@atproto/lex'
import { Client } from '@atproto/lex'
import * as com from '#shared/types/lexicons/com'
import * as app from '#shared/types/lexicons/app'
import { isAtIdentifierString } from '@atproto/lex'
import { scope } from '#server/utils/atproto/oauth'
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
  const session = await useServerSession(event)
  const atclient = await getNodeOAuthClient(session, config)

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
        // TODO: I do not beleive this is working as expected on
        // a unsupported locale on the PDS. Gives Invalid at body.ui_locales
        // Commenting out for now
        // ui_locales: query.locale?.toString(),
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
      if (error instanceof OAuthCallbackError && error.state) {
        // Always decode the state, to clean up the cookie
        const state = decodeOAuthState(event, error.state)

        // user cancelled explicitly
        if (query.error === 'access_denied') {
          return sendRedirect(event, state.redirectPath)
        }
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

const OAUTH_REQUEST_COOKIE_PREFIX = 'atproto_oauth_req'

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
 * @param event The H3 event object, used to set the cookie
 * @param state The original OAuth state to encode
 * @returns A JSON string encapsulating the original state and the generated SID
 */
function encodeOAuthState(event: H3Event, data: OAuthStateData): string {
  const id = generateRandomHexString()
  // This uses an ephemeral cookie instead of useSession() to avoid polluting
  // the session with ephemeral OAuth-specific data. The cookie is set with a
  // short expiration time to limit the window of potential misuse, and is
  // deleted immediately after validating the callback to clean up any remnants
  // of the authentication flow. Using useSession() for this would require
  // additional logic to clean up the session in case of expired ephemeral data.

  // We use the id as cookie name to allow multiple concurrent auth flows (e.g.
  // user opens multiple tabs and initiates auth in both, or initiates auth,
  // waits for a while, then initiates again before completing the first one),
  // without risk of cookie value collisions between them. The cookie value is a
  // constant since the actual value doesn't matter - it's just used as a flag
  // to validate the presence of the cookie on callback.
  setCookie(event, `${OAUTH_REQUEST_COOKIE_PREFIX}_${id}`, '1', {
    maxAge: 60 * 5,
    httpOnly: true,
    // secure only if NOT in dev mode
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: event.path.split('?', 1)[0],
  })

  return JSON.stringify({ data, id })
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
 * @param state The JSON string containing the original state and id
 * @returns The original OAuth state if the id is valid
 * @throws An error if the id is missing or invalid, indicating a potential issue with cookies or expired state
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
  const decoded = JSON.parse(state) as { data: OAuthStateData; id: string }
  const requestCookieName = `${OAUTH_REQUEST_COOKIE_PREFIX}_${decoded.id}`

  if (getCookie(event, requestCookieName) != null) {
    // The cookie will never be used again since the state store ensure unique
    // nonces, but we delete it to clean up any remnants of the authentication
    // flow.
    deleteCookie(event, requestCookieName, {
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'lax',
      path: event.path.split('?', 1)[0],
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
