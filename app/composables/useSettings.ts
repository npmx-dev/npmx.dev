import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'

/**
 * Application settings stored in localStorage
 */
export interface AppSettings {
  /** Display dates as relative (e.g., "3 days ago") instead of absolute */
  relativeDates: boolean
  /** Include @types/* package in install command for packages without built-in types */
  includeTypesInInstall: boolean
  /** Theme of site, default dark */
  theme: 'dark' | 'light'
}

const DEFAULT_SETTINGS: AppSettings = {
  relativeDates: false,
  includeTypesInInstall: true,
  theme: 'dark',
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
