import { ACCENT_COLORS, BACKGROUND_THEMES } from '#shared/utils/constants'
import {
  DEFAULT_USER_PREFERENCES,
  type AccentColorId,
  type BackgroundThemeId,
  type ColorModePreference,
} from '#shared/schemas/userPreferences'

/**
 * Main composable for user preferences.
 * Uses `npmx-user-preferences` localStorage key and syncs to the server
 * for authenticated users via `useUserPreferencesProvider`.
 */
export function useUserPreferences() {
  const provider = useUserPreferencesProvider(DEFAULT_USER_PREFERENCES)

  return {
    preferences: provider.data,
    isAuthenticated: provider.isAuthenticated,
    isSyncing: provider.isSyncing,
    isSynced: provider.isSynced,
    hasError: provider.hasError,
    syncError: provider.syncError,
    lastSyncedAt: provider.lastSyncedAt,
    initSync: provider.initSync,
  }
}

export function useRelativeDates() {
  const { preferences } = useUserPreferences()
  return computed(() => preferences.value.relativeDates)
}

export function useAccentColor() {
  const { preferences } = useUserPreferences()
  const colorMode = useColorMode()

  const accentColors = computed(() => {
    const isDark = colorMode.value === 'dark'
    const colors = isDark ? ACCENT_COLORS.dark : ACCENT_COLORS.light

    return Object.entries(colors).map(([id, value]) => ({
      id: id as AccentColorId,
      name: id,
      value,
    }))
  })

  function setAccentColor(id: AccentColorId | null) {
    if (id) {
      document.documentElement.style.setProperty('--accent-color', `var(--swatch-${id})`)
    } else {
      document.documentElement.style.removeProperty('--accent-color')
    }
    preferences.value.accentColorId = id
  }

  return {
    accentColors,
    selectedAccentColor: computed(() => preferences.value.accentColorId),
    setAccentColor,
  }
}

export function useBackgroundTheme() {
  const backgroundThemes = Object.entries(BACKGROUND_THEMES).map(([id, value]) => ({
    id: id as BackgroundThemeId,
    name: id,
    value,
  }))

  const { preferences } = useUserPreferences()

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

/**
 * Composable for syncing color mode preference.
 * Keeps the user preference in sync with @nuxtjs/color-mode's own LS key (`npmx-color-mode`)
 * so that the color-mode module picks up the correct value on page load.
 */
export function useColorModePreference() {
  const { preferences } = useUserPreferences()
  const colorMode = useColorMode()

  /**
   * Set color mode preference and sync to both user preferences and the
   * `npmx-color-mode` LS key used by @nuxtjs/color-mode.
   */
  function setColorMode(mode: ColorModePreference) {
    preferences.value.colorModePreference = mode
    colorMode.preference = mode
  }

  /**
   * On init, if the user has a stored preference, apply it to @nuxtjs/color-mode.
   * This handles the case where preferences were synced from the server.
   */
  function applyStoredColorMode() {
    const stored = preferences.value.colorModePreference
    if (stored) {
      colorMode.preference = stored
    } else {
      // No user preference stored yet — seed it from the current color-mode LS value
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
