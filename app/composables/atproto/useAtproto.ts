import type { UserSession } from '#shared/schemas/userSession'
import type { LocationQueryRaw } from 'vue-router'

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

export function useAtproto() {
  const { data: user, pending, clear } = useFetch<UserSession | null>('/api/auth/session')

  async function logout() {
    await $fetch('/api/auth/session', {
      method: 'delete',
    })

    clear()
  }

  return { user, pending, logout }
}
