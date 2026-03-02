import { BACKGROUND_THEMES } from '#shared/utils/constants'
import type { BackgroundThemeId } from '#shared/schemas/userPreferences'

export function useBackgroundTheme() {
  const backgroundThemes = Object.entries(BACKGROUND_THEMES).map(([id, value]) => ({
    id: id as BackgroundThemeId,
    name: id,
    value,
  }))

  const { preferences } = useUserPreferencesState()

  function setBackgroundTheme(id: BackgroundThemeId | null) {
    if (id) {
      document.documentElement.dataset.bgTheme = id
    } else {
      document.documentElement.removeAttribute('data-bg-theme')
    }
    preferences.value.preferredBackgroundTheme = id
  }

  return {
    backgroundThemes,
    selectedBackgroundTheme: computed(() => preferences.value.preferredBackgroundTheme),
    setBackgroundTheme,
  }
}
