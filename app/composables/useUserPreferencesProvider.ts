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
import { DEFAULT_USER_PREFERENCES } from '#shared/schemas/userPreferences'
import {
  arePreferencesEqual,
  mergePreferences,
  type HydratedUserPreferences,
} from '~/utils/preferences-merge'

const STORAGE_KEY = 'npmx-user-preferences'

let dataRef: RemovableRef<HydratedUserPreferences> | null = null
let syncInitialized = false

export function useUserPreferencesProvider(
  defaultValue: HydratedUserPreferences = DEFAULT_USER_PREFERENCES,
) {
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
      const serverResult = await loadFromServer()
      const { merged, shouldPushToServer } = mergePreferences(preferences.value, serverResult)
      if (shouldPushToServer) {
        scheduleSync(preferences.value)
      } else if (!arePreferencesEqual(preferences.value, merged)) {
        preferences.value = merged
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
        const serverResult = await loadFromServer()
        const { merged, shouldPushToServer } = mergePreferences(preferences.value, serverResult)
        if (shouldPushToServer) {
          scheduleSync(preferences.value)
        } else if (!arePreferencesEqual(preferences.value, merged)) {
          preferences.value = merged
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
