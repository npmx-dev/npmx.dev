function login(redirectTo?: string) {
  const query: Record<string, string> = {}
  if (redirectTo) {
    query.returnTo = redirectTo
  }
  navigateTo(
    {
      path: '/api/auth/github',
      query,
    },
    { external: true },
  )
}

export const useGitHub = createSharedComposable(function useGitHub() {
  const {
    data: user,
    pending,
    clear,
    refresh,
  } = useFetch<{ username: string } | null>('/api/auth/github/session', {
    server: false,
    immediate: !import.meta.test,
  })

  const isConnected = computed(() => !!user.value?.username)

  async function logout() {
    await $fetch('/api/auth/github/session', {
      method: 'delete',
    })

    clear()
  }

  return { user, isConnected, pending, logout, login, refresh }
})
