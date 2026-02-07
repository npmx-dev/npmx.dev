import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'
import { ACCENT_COLORS } from '#shared/utils/constants'
import { BACKGROUND_THEMES } from '#shared/utils/constants'
import type { AccentColorId, BackgroundThemeId, AppSettings } from '#shared/schemas/app-settings'

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  relativeDates: false,
  includeTypesInInstall: true,
  accentColorId: null,
  hidePlatformPackages: true,
  selectedLocale: null,
  preferredBackgroundTheme: null,
  sidebar: {
    collapsed: [],
  },
}

export const syncSettings = async (settings: AppSettings) => {
  // DO some error handling
  await $fetch('/api/auth/settings', {
    method: 'POST',
    body: settings,
  })
}

const STORAGE_KEY = 'npmx-settings'

// Shared settings instance (singleton per app)
let settingsRef: RemovableRef<AppSettings> | null = null

/**
 * Composable for managing application settings with localStorage persistence.
 * Settings are shared across all components that use this composable.
 */
export function useSettings() {
  if (!settingsRef) {
    settingsRef = useLocalStorage<AppSettings>(STORAGE_KEY, DEFAULT_SETTINGS, {
      mergeDefaults: true,
    })
  }

  return {
    settings: settingsRef,
  }
}

/**
 * Composable for accessing just the relative dates setting.
 * Useful for components that only need to read this specific setting.
 */
export function useRelativeDates() {
  const { settings } = useSettings()
  return computed(() => settings.value.relativeDates)
}

/**
 * Composable for managing accent color.
 */
export function useAccentColor() {
  const { settings } = useSettings()
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
      const isDark = colorMode.value === 'dark'
      const color = isDark ? ACCENT_COLORS.dark[id] : ACCENT_COLORS.light[id]
      document.documentElement.style.setProperty('--accent-color', color)
    } else {
      document.documentElement.style.removeProperty('--accent-color')
    }
    settings.value.accentColorId = id
  }

  // Update accent color when color mode changes
  watch(
    () => colorMode.value,
    () => {
      if (settings.value.accentColorId) {
        setAccentColor(settings.value.accentColorId)
      }
    },
  )

  return {
    accentColors,
    selectedAccentColor: computed(() => settings.value.accentColorId),
    setAccentColor,
  }
}

export function useBackgroundTheme() {
  const backgroundThemes = Object.entries(BACKGROUND_THEMES).map(([id, value]) => ({
    id: id as BackgroundThemeId,
    name: id,
    value,
  }))

  const { settings } = useSettings()

  function setBackgroundTheme(id: BackgroundThemeId | null) {
    if (id) {
      document.documentElement.dataset.bgTheme = id
    } else {
      document.documentElement.removeAttribute('data-bg-theme')
    }
    settings.value.preferredBackgroundTheme = id
  }

  return {
    backgroundThemes,
    selectedBackgroundTheme: computed(() => settings.value.preferredBackgroundTheme),
    setBackgroundTheme,
  }
}
