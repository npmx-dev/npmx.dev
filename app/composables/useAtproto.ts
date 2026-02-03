import type { UserSession } from '#shared/schemas/userSession'

export function useAtproto() {
  if (import.meta.server) {
    return {
      user: ref(null),
      pending: ref(false),
      logout: async () => {},
    }
  }

  const { data: user, pending, clear } = useFetch<UserSession | null>('/api/auth/session')

  async function logout() {
    await $fetch('/api/auth/session', {
      method: 'delete',
    })

    clear()
  }

  return { user, pending, logout }
}
