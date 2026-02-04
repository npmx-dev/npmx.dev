import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'
import { ACCENT_COLORS } from '#shared/utils/constants'
import type { LocaleObject } from '@nuxtjs/i18n'
import { BACKGROUND_THEMES } from '#shared/utils/constants'

type BackgroundThemeId = keyof typeof BACKGROUND_THEMES

type AccentColorId = keyof typeof ACCENT_COLORS.light

/**
 * Application settings stored in localStorage
 */
export interface AppSettings {
  /** Display dates as relative (e.g., "3 days ago") instead of absolute */
  relativeDates: boolean
  /** Include @types/* package in install command for packages without built-in types */
  includeTypesInInstall: boolean
  /** Accent color theme */
  accentColorId: AccentColorId | null
  /** Preferred background shade */
  preferredBackgroundTheme: BackgroundThemeId | null
  /** Hide platform-specific packages (e.g., @scope/pkg-linux-x64) from search results */
  hidePlatformPackages: boolean
  /** User-selected locale */
  selectedLocale: LocaleObject['code'] | null
  sidebar: {
    collapsed: string[]
  }
}

const DEFAULT_SETTINGS: AppSettings = {
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
