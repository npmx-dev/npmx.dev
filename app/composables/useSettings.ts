import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'
import { ACCENT_COLORS } from '#shared/utils/constants'
import type { LocaleObject } from '@nuxtjs/i18n'

type AccentColorId = keyof typeof ACCENT_COLORS

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

  const accentColors = Object.entries(ACCENT_COLORS).map(([id, value]) => ({
    id: id as AccentColorId,
    name: id,
    value,
  }))

  function setAccentColor(id: AccentColorId | null) {
    const color = id ? ACCENT_COLORS[id] : null
    if (color) {
      document.documentElement.style.setProperty('--accent-color', color)
    } else {
      document.documentElement.style.removeProperty('--accent-color')
    }
    settings.value.accentColorId = id
  }

  return {
    accentColors,
    selectedAccentColor: computed(() => settings.value.accentColorId),
    setAccentColor,
  }
}
