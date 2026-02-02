import type { FetchError } from 'ofetch'
import { authRedirect } from '~/composables/atproto/useAtproto'

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
