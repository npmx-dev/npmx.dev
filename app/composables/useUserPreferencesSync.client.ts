import type { UserPreferences } from '#shared/schemas/userPreferences'
import { DEFAULT_USER_PREFERENCES } from '#shared/schemas/userPreferences'

const SYNC_DEBOUNCE_MS = 2000
const SYNCED_DISPLAY_MS = 3000

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

interface PreferencesSyncState {
  status: Ref<SyncStatus>
  lastSyncedAt: Ref<Date | null>
  error: Ref<string | null>
}

let syncStateInstance: PreferencesSyncState | null = null
let pendingSavePromise: Promise<boolean> | null = null
let hasPendingChanges = false
let debounceTimeoutId: ReturnType<typeof setTimeout> | null = null
let syncedResetTimeoutId: ReturnType<typeof setTimeout> | null = null

function getSyncState(): PreferencesSyncState {
  if (!syncStateInstance) {
    syncStateInstance = {
      status: ref<SyncStatus>('idle'),
      lastSyncedAt: ref<Date | null>(null),
      error: ref<string | null>(null),
    }
  }
  return syncStateInstance
}

async function fetchServerPreferences(): Promise<UserPreferences | null> {
  try {
    const response = await $fetch<UserPreferences>('/api/user/preferences', {
      method: 'GET',
    })
    return response
  } catch {
    return null
  }
}

/** Show 'synced' status briefly, then reset to 'idle'. */
function showSyncedStatus(): void {
  const state = getSyncState()
  if (syncedResetTimeoutId) {
    clearTimeout(syncedResetTimeoutId)
  }
  state.status.value = 'synced'
  state.lastSyncedAt.value = new Date()
  syncedResetTimeoutId = setTimeout(() => {
    syncedResetTimeoutId = null

    if (state.status.value === 'synced') {
      state.status.value = 'idle'
    }
  }, SYNCED_DISPLAY_MS)
}

async function saveToServer(preferences: UserPreferences): Promise<boolean> {
  const state = getSyncState()
  state.status.value = 'syncing'
  state.error.value = null

  try {
    await $fetch('/api/user/preferences', {
      method: 'PUT',
      body: preferences,
    })
    showSyncedStatus()
    hasPendingChanges = false
    return true
  } catch (err) {
    state.status.value = 'error'
    state.error.value = err instanceof Error ? err.message : 'Failed to save preferences'
    return false
  }
}

function cancelPendingDebounce(): void {
  if (debounceTimeoutId) {
    clearTimeout(debounceTimeoutId)
    debounceTimeoutId = null
  }
}

export function useUserPreferencesSync() {
  const { user } = useAtproto()
  const state = getSyncState()
  const router = useRouter()

  const isAuthenticated = computed(() => !!user.value?.did)

  function scheduleSync(preferences: UserPreferences): void {
    if (!isAuthenticated.value) return

    hasPendingChanges = true
    cancelPendingDebounce()

    debounceTimeoutId = setTimeout(async () => {
      debounceTimeoutId = null
      pendingSavePromise = saveToServer(preferences)
      await pendingSavePromise
      pendingSavePromise = null
    }, SYNC_DEBOUNCE_MS)
  }

  async function loadFromServer(): Promise<UserPreferences> {
    if (!isAuthenticated.value) {
      return { ...DEFAULT_USER_PREFERENCES }
    }

    state.status.value = 'syncing'
    const serverPreferences = await fetchServerPreferences()

    if (serverPreferences) {
      showSyncedStatus()
      return serverPreferences
    }

    state.status.value = 'idle'
    return { ...DEFAULT_USER_PREFERENCES }
  }

  async function flushPendingSync(preferences: UserPreferences): Promise<void> {
    if (!isAuthenticated.value || !hasPendingChanges) return

    cancelPendingDebounce()

    if (pendingSavePromise) {
      await pendingSavePromise
    } else {
      await saveToServer(preferences)
    }
  }

  function setupRouteGuard(getPreferences: () => UserPreferences): void {
    router.beforeEach(async (_to, _from, next) => {
      if (hasPendingChanges && isAuthenticated.value) {
        void flushPendingSync(getPreferences())
      }
      next()
    })
  }

  function setupBeforeUnload(getPreferences: () => UserPreferences): void {
    if (import.meta.server) return

    window.addEventListener('beforeunload', () => {
      if (hasPendingChanges && isAuthenticated.value) {
        const preferences = getPreferences()
        navigator.sendBeacon(
          '/api/user/preferences',
          new Blob([JSON.stringify(preferences)], { type: 'application/json' }),
        )
      }
    })
  }

  return {
    status: state.status,
    lastSyncedAt: state.lastSyncedAt,
    error: state.error,
    loadFromServer,
    scheduleSync,
    setupRouteGuard,
    setupBeforeUnload,
  }
}
