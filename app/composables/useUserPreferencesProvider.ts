/**
 * Abstraction for user preferences storage
 * Supports both localStorage (for anonymous users) and API-based storage (for authenticated users)
 *
 * Design:
 * - Anonymous users: localStorage only
 * - Authenticated users: localStorage as cache, API as source of truth
 * - Changes sync to server with debounce (2s) and on route change/page unload
 *
 * Module-level singletons are safe here: on the server, useLocalStorage returns
 * a ref with defaults (no real localStorage); on the client, there's only one app instance.
 */

import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'
import type { UserPreferences } from '#shared/schemas/userPreferences'

const STORAGE_KEY = 'npmx-user-preferences'

export type HydratedUserPreferences = Required<Omit<UserPreferences, 'updatedAt'>> &
  Pick<UserPreferences, 'updatedAt'>

let dataRef: RemovableRef<HydratedUserPreferences> | null = null
let syncInitialized = false

/**
 * User preferences provider with server sync support.
 */
export function useUserPreferencesProvider(defaultValue: HydratedUserPreferences) {
  if (!dataRef) {
    dataRef = useLocalStorage<HydratedUserPreferences>(STORAGE_KEY, defaultValue, {
      mergeDefaults: true,
    })
  }

  // After the guard above, dataRef is guaranteed to be initialized.
  const preferences: RemovableRef<HydratedUserPreferences> = dataRef

  const { user } = useAtproto()

  const isAuthenticated = computed(() => !!user.value?.did)
  const {
    status,
    lastSyncedAt,
    error,
    loadFromServer,
    scheduleSync,
    setupRouteGuard,
    setupBeforeUnload,
  } = useUserPreferencesSync()

  const isSyncing = computed(() => status.value === 'syncing')
  const isSynced = computed(() => status.value === 'synced')
  const hasError = computed(() => status.value === 'error')

  async function initSync(): Promise<void> {
    if (syncInitialized || import.meta.server) return
    syncInitialized = true

    setupRouteGuard(() => preferences.value)
    setupBeforeUnload(() => preferences.value)

    if (isAuthenticated.value) {
      const serverPrefs = await loadFromServer()
      if (serverPrefs) {
        preferences.value = { ...preferences.value, ...serverPrefs }
      }
    }

    watch(
      preferences,
      newPrefs => {
        if (isAuthenticated.value) {
          scheduleSync(newPrefs)
        }
      },
      { deep: true },
    )

    watch(isAuthenticated, async newIsAuth => {
      if (newIsAuth) {
        const serverPrefs = await loadFromServer()
        if (serverPrefs) {
          preferences.value = { ...defaultValue, ...preferences.value, ...serverPrefs }
        }
      }
    })
  }

  return {
    data: preferences,
    isAuthenticated,
    isSyncing,
    isSynced,
    hasError,
    syncError: error,
    lastSyncedAt,
    initSync,
  }
}
