export function useRelativeDates() {
  const { preferences } = useUserPreferencesState()
  return computed(() => preferences.value.relativeDates)
}
