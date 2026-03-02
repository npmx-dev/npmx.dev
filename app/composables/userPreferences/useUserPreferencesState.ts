/**
 * Read-only access to persisted user preferences state.
 */
export function useUserPreferencesState() {
  const provider = useUserPreferencesProvider()

  return {
    preferences: provider.data,
  }
}
