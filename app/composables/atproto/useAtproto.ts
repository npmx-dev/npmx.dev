import {
  clearClientSessionHintCookie,
  hasSessionHintCookie,
  markSessionHintMigrated,
  needsSessionHintMigration,
} from '~/utils/atproto/session-hint'

export const useAtproto = createSharedComposable(function useAtproto() {
  const shouldFetch = import.meta.client && (hasSessionHintCookie() || needsSessionHintMigration())

  const {
    data: user,
    pending,
    clear,
  } = useFetch('/api/auth/session', {
    server: false,
    immediate: shouldFetch,
    transform(data) {
      if (needsSessionHintMigration()) {
        markSessionHintMigrated()
      }
      if (!data && hasSessionHintCookie()) {
        clearClientSessionHintCookie()
      }
      return data
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        if (hasSessionHintCookie()) {
          clearClientSessionHintCookie()
        }
        markSessionHintMigrated()
      }
    },
  })

  async function logout() {
    try {
      await $fetch('/api/auth/session', {
        method: 'delete',
      })
    } catch (error) {
      const status =
        (error as { statusCode?: number; status?: number })?.statusCode ??
        (error as { statusCode?: number; status?: number })?.status
      if (status !== 401) {
        throw error
      }
    }

    clearClientSessionHintCookie()
    markSessionHintMigrated()
    clear()
  }

  return { user, pending, logout }
})
