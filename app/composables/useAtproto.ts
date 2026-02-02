import { ERROR_NEED_REAUTH } from '#imports'
import type { FetchError } from 'ofetch'
import type { UserSession } from '#shared/schemas/userSession'
import type { PackageLikes } from '~~/server/utils/atproto/utils/likes'

export async function authRedirect(identifier: string, create: boolean = false) {
  let query = { handle: identifier } as {}
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

export async function handleAuthError(e: unknown, userHandle?: string | null): Promise<never> {
  const fetchError = e as FetchError
  const errorMessage = fetchError?.data?.message
  if (errorMessage === ERROR_NEED_REAUTH && userHandle) {
    await authRedirect(userHandle)
  }
  throw e
}

export function useAtproto() {
  const {
    data: user,
    pending,
    clear,
  } = useFetch('/api/auth/session', {
    server: false,
    immediate: !import.meta.test,
  })

  async function logout() {
    await $fetch('/api/auth/session', {
      method: 'delete',
    })

    clear()
  }

  return { user, pending, logout }
}

export function useLikePackage(packageName: string) {
  const { user } = useAtproto()
  const data = ref<PackageLikes | null>(null)
  const error = ref<Error | null>(null)
  const pending = ref(false)

  const mutate = async () => {
    pending.value = true
    error.value = null

    try {
      const result = await $fetch<PackageLikes>('/api/auth/social/like', {
        method: 'POST',
        body: { packageName },
      })

      data.value = result
      return result
    } catch (e) {
      error.value = e as FetchError
      await handleAuthError(e, user.value?.handle)
    } finally {
      pending.value = false
    }
  }

  return { data, error, pending, mutate }
}
