import { createError, getQuery, sendRedirect, setCookie, getCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'
import { generateRandomHexString } from '#server/utils/auth'
import { useServerSession } from '#server/utils/server-session'
import { handleApiError } from '#server/utils/error-handler'
import { UNSET_NUXT_SESSION_PASSWORD } from '#shared/utils/constants'
// @ts-expect-error virtual file from oauth module
import { clientUri } from '#oauth/config'

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_STATE_COOKIE = 'github_oauth_state'

export default defineEventHandler(async event => {
  const config = useRuntimeConfig(event)
  if (!config.sessionPassword) {
    throw createError({
      status: 500,
      message: UNSET_NUXT_SESSION_PASSWORD,
    })
  }

  if (!config.github.clientId || !config.github.clientSecret) {
    throw createError({
      statusCode: 500,
      message: 'GitHub OAuth is not configured.',
    })
  }

  const query = getQuery(event)

  // If no code, initiate the OAuth flow
  if (!query.code) {
    const state = generateRandomHexString()

    // Store returnTo path
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

    setCookie(event, GITHUB_STATE_COOKIE, JSON.stringify({ state, redirectPath }), {
      maxAge: 60 * 5,
      httpOnly: true,
      secure: !import.meta.dev,
      sameSite: 'lax',
      path: '/api/auth/github',
    })

    const params = new URLSearchParams({
      client_id: config.github.clientId,
      redirect_uri: `${clientUri}/api/auth/github`,
      scope: 'public_repo',
      state,
    })

    return sendRedirect(event, `${GITHUB_AUTHORIZE_URL}?${params.toString()}`)
  }

  // Handle callback
  try {
    const stateData = decodeGitHubState(event, query.state?.toString() ?? '')

    const tokenResponse = await $fetch<{ access_token: string; token_type: string }>(
      GITHUB_TOKEN_URL,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        body: {
          client_id: config.github.clientId,
          client_secret: config.github.clientSecret,
          code: query.code,
          redirect_uri: `${clientUri}/api/auth/github`,
        },
      },
    )

    if (!tokenResponse.access_token) {
      throw createError({
        statusCode: 401,
        message: 'Failed to obtain GitHub access token.',
      })
    }

    const githubUser = await $fetch<{ login: string }>(GITHUB_USER_URL, {
      headers: {
        'Authorization': `Bearer ${tokenResponse.access_token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'npmx',
      },
    })

    const session = await useServerSession(event)
    await session.update({
      github: {
        accessToken: tokenResponse.access_token,
        username: githubUser.login,
      },
    })

    return sendRedirect(event, stateData.redirectPath)
  } catch (error) {
    // User cancelled
    if (query.error === 'access_denied') {
      return sendRedirect(event, '/')
    }

    const message = error instanceof Error ? error.message : 'GitHub authentication failed.'
    return handleApiError(error, {
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: `${message}. Please try again.`,
    })
  }
})

function decodeGitHubState(event: H3Event, state: string): { redirectPath: string } {
  const cookieValue = getCookie(event, GITHUB_STATE_COOKIE)

  if (!cookieValue) {
    throw createError({
      statusCode: 400,
      message: 'Missing GitHub authentication state. Please enable cookies and try again.',
    })
  }

  const stored = JSON.parse(cookieValue) as { state: string; redirectPath: string }

  if (stored.state !== state) {
    throw createError({
      statusCode: 400,
      message: 'Invalid authentication state. Please try again.',
    })
  }

  deleteCookie(event, GITHUB_STATE_COOKIE, {
    httpOnly: true,
    secure: !import.meta.dev,
    sameSite: 'lax',
    path: '/api/auth/github',
  })

  return { redirectPath: stored.redirectPath }
}
