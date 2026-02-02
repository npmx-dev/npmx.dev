import type { UserSession } from '#shared/schemas/userSession'
import type { PackageLikes } from '~~/server/utils/atproto/utils/likes'

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
  const data = ref<PackageLikes | null>(null)
  const error = ref<Error | null>(null)
  const pending = ref(false)

  const mutate = async () => {
    pending.value = true
    error.value = null

    try {
      const result = await $fetch('/api/auth/social/like', {
        method: 'POST',
        body: { packageName },
      })
      data.value = result
      return result
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      pending.value = false
    }
  }

  return { data, error, pending, mutate }
}
