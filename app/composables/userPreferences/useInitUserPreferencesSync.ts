/**
 * Imperative initialization for preferences sync lifecycle hooks.
 */
export function useInitUserPreferencesSync() {
  const provider = useUserPreferencesProvider()

  return {
    initSync: provider.initSync,
  }
}
