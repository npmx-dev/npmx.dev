import type { SearchProvider } from '#shared/schemas/userPreferences'

export function useSearchProvider() {
  const { preferences } = useUserPreferencesState()

  const searchProvider = computed({
    get: () => preferences.value.searchProvider ?? 'algolia',
    set: (value: SearchProvider) => {
      preferences.value.searchProvider = value
    },
  })

  const isAlgolia = computed(() => searchProvider.value === 'algolia')

  function toggle() {
    searchProvider.value = searchProvider.value === 'npm' ? 'algolia' : 'npm'
  }

  return {
    searchProvider,
    isAlgolia,
    toggle,
  }
}
