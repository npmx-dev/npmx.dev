import type { FetchError } from 'ofetch'
import type { LocationQueryRaw } from 'vue-router'

interface AuthRedirectOptions {
  create?: boolean
  redirectTo?: string
  locale?: string
}

/**
 * Redirect user to ATProto authentication
 */
export async function authRedirect(identifier: string, options: AuthRedirectOptions = {}) {
  let query: LocationQueryRaw = { handle: identifier, locale: options.locale || 'en' }
  if (options.create) {
    query = { ...query, create: 'true' }
  }
  if (options.redirectTo) {
    query = { ...query, returnTo: options.redirectTo }
  }
  await navigateTo(
    {
      path: '/api/auth/atproto',
      query,
    },
    { external: true },
  )
}

export async function handleAuthError(
  fetchError: FetchError,
  userHandle?: string | null,
): Promise<never> {
  const errorMessage = fetchError?.data?.message
  if (errorMessage === ERROR_NEED_REAUTH && userHandle) {
    await authRedirect(userHandle)
  }
  throw fetchError
}
