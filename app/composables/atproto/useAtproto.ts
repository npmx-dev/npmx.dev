export const useAtproto = createSharedComposable(function useAtproto() {
  const {
    data: user,
    pending,
    clear,
  } = useFetch('/api/auth/session', {
    server: false,
  })

  async function logout() {
    await $fetch('/api/auth/session', {
      method: 'delete',
    })

    clear()
  }

  return { user, pending, logout }
})
