export const useAtproto = createSharedComposable(function useAtproto() {
  const {
    data: user,
    pending,
    clear,
  } = useFetch('/api/auth/atproto/session', {
    server: false,
    immediate: !import.meta.test,
  })

  async function logout() {
    await $fetch('/api/auth/atproto/session', {
      method: 'delete',
    })

    clear()
  }

  return { user, pending, logout }
})
