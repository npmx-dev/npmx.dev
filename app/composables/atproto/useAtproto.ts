import type { UserSession } from '#shared/schemas/userSession'

export const useAtproto = createSharedComposable(function useAtproto() {
  const {
    data: user,
    pending,
    clear,
  } = useFetch<UserSession | null>('/api/auth/session', {
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
})
