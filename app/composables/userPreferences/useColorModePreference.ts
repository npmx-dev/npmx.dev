import type { ColorModePreference } from '#shared/schemas/userPreferences'

/**
 * Composable for syncing color mode preference.
 * Keeps the user preference aligned with @nuxtjs/color-mode.
 */
export function useColorModePreference() {
  const { preferences } = useUserPreferencesState()
  const colorMode = useColorMode()

  function setColorMode(mode: ColorModePreference) {
    preferences.value.colorModePreference = mode
    colorMode.preference = mode
  }

  function applyStoredColorMode() {
    const stored = preferences.value.colorModePreference
    if (stored) {
      colorMode.preference = stored
    } else {
      const currentPreference = colorMode.preference as ColorModePreference
      if (currentPreference && currentPreference !== 'system') {
        preferences.value.colorModePreference = currentPreference
      }
    }
  }

  return {
    colorModePreference: computed(
      () => preferences.value.colorModePreference ?? colorMode.preference,
    ),
    setColorMode,
    applyStoredColorMode,
  }
}
