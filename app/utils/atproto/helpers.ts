import type { FetchError } from 'ofetch'
import type { LocationQueryRaw } from 'vue-router'

/**
 * Redirect user to ATProto authentication
 */
export async function authRedirect(identifier: string, create: boolean = false) {
  let query: LocationQueryRaw = { handle: identifier }
  if (create) {
    query = { ...query, create: 'true' }
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
