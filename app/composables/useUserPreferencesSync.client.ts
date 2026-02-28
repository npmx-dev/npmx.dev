import type { UserPreferences } from '#shared/schemas/userPreferences'
import { DEFAULT_USER_PREFERENCES } from '#shared/schemas/userPreferences'

const SYNC_DEBOUNCE_MS = 2000
const SYNCED_DISPLAY_MS = 3000

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error'

export interface ServerPreferencesResult {
  /** The preferences from the server, or defaults if unavailable */
  preferences: UserPreferences
  /** True when the server has no stored preferences for this user (first login) */
  isNewUser: boolean
}

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

type FetchResult =
  | { status: 'found'; data: UserPreferences }
  | { status: 'new-user' }
  | { status: 'error' }

async function fetchServerPreferences(): Promise<FetchResult> {
  try {
    const response = await $fetch<UserPreferences | null>('/api/user/preferences', {
      method: 'GET',
    })

    // Server returns null when no stored preferences exist (first-time user)
    if (response === null) {
      return { status: 'new-user' }
    }

    return { status: 'found', data: response }
  } catch {
    return { status: 'error' }
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

  async function loadFromServer(): Promise<ServerPreferencesResult> {
    if (!isAuthenticated.value) {
      return { preferences: { ...DEFAULT_USER_PREFERENCES }, isNewUser: false }
    }

    state.status.value = 'syncing'
    const result = await fetchServerPreferences()

    if (result.status === 'found') {
      showSyncedStatus()
      return { preferences: result.data, isNewUser: false }
    }

    if (result.status === 'new-user') {
      showSyncedStatus()
      return { preferences: { ...DEFAULT_USER_PREFERENCES }, isNewUser: true }
    }

    // Network error — fall back to defaults, don't flag as new user
    state.status.value = 'idle'
    return { preferences: { ...DEFAULT_USER_PREFERENCES }, isNewUser: false }
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
