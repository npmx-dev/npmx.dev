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
