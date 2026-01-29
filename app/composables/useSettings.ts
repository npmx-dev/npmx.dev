import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'
import { ACCENT_COLORS } from '#shared/utils/constants'

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
}

const DEFAULT_SETTINGS: AppSettings = {
  relativeDates: false,
  includeTypesInInstall: true,
  accentColorId: null,
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
 * @public
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

/**
 * Applies accent color before hydration to prevent flash of default color.
 * Call this from app.vue to ensure accent color is applied on every page.
 * @public
 */
export function initAccentOnPrehydrate() {
  // Callback is stringified by Nuxt - external variables won't be available.
  // Colors must be hardcoded since ACCENT_COLORS can't be referenced.
  onPrehydrate(() => {
    const colors: Record<AccentColorId, string> = {
      rose: 'oklch(0.797 0.084 11.056)',
      amber: 'oklch(0.828 0.165 84.429)',
      emerald: 'oklch(0.792 0.153 166.95)',
      sky: 'oklch(0.787 0.128 230.318)',
      violet: 'oklch(0.714 0.148 286.067)',
      coral: 'oklch(0.704 0.177 14.75)',
    }
    const settings = JSON.parse(localStorage.getItem('npmx-settings') || '{}')
    const color = settings.accentColorId ? colors[settings.accentColorId as AccentColorId] : null
    if (color) {
      document.documentElement.style.setProperty('--accent-color', color)
    }
  })
}
