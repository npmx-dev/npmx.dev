/**
 * Sync status signals for authenticated preference syncing UI.
 */
export function useUserPreferencesSyncStatus() {
  const provider = useUserPreferencesProvider()

  return {
    isAuthenticated: provider.isAuthenticated,
    isSyncing: provider.isSyncing,
    isSynced: provider.isSynced,
    hasError: provider.hasError,
    syncError: provider.syncError,
    lastSyncedAt: provider.lastSyncedAt,
  }
}
