import { ACCENT_COLORS } from '#shared/utils/constants'
import type { LocaleObject } from '@nuxtjs/i18n'
import { BACKGROUND_THEMES } from '#shared/utils/constants'

type BackgroundThemeId = keyof typeof BACKGROUND_THEMES

type AccentColorId = keyof typeof ACCENT_COLORS.light

/** Available search providers */
export type SearchProvider = 'npm' | 'algolia'

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
  /** Search provider for package search */
  searchProvider: SearchProvider
  /** Show search results as you type */
  instantSearch: boolean
  /** Enable/disable keyboard shortcuts */
  keyboardShortcuts: boolean
  /** Connector preferences */
  connector: {
    /** Automatically open the web auth page in the browser */
    autoOpenURL: boolean
  }
  sidebar: {
    collapsed: string[]
  }
  chartFilter: {
    averageWindow: number
    smoothingTau: number
    anomaliesFixed: boolean
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  relativeDates: false,
  includeTypesInInstall: true,
  accentColorId: null,
  hidePlatformPackages: true,
  selectedLocale: null,
  preferredBackgroundTheme: null,
  searchProvider: import.meta.test ? 'npm' : 'algolia',
  instantSearch: true,
  keyboardShortcuts: true,
  connector: {
    autoOpenURL: false,
  },
  sidebar: {
    collapsed: [],
  },
  chartFilter: {
    averageWindow: 0,
    smoothingTau: 1,
    anomaliesFixed: true,
  },
}

const STORAGE_KEY = 'npmx-settings'

/**
 * Read settings from localStorage and merge with defaults.
 */
function normaliseSettings(input: AppSettings): AppSettings {
  return {
    ...input,
    searchProvider: input.searchProvider === 'npm' ? 'npm' : 'algolia',
    sidebar: {
      ...input.sidebar,
      collapsed: Array.isArray(input.sidebar?.collapsed)
        ? input.sidebar.collapsed.filter((v): v is string => typeof v === 'string')
        : [],
    },
  }
}

function readFromLocalStorage(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = JSON.parse(raw)
      return normaliseSettings({
        ...DEFAULT_SETTINGS,
        ...stored,
        connector: { ...DEFAULT_SETTINGS.connector, ...stored.connector },
        sidebar: { ...DEFAULT_SETTINGS.sidebar, ...stored.sidebar },
        chartFilter: { ...DEFAULT_SETTINGS.chartFilter, ...stored.chartFilter },
      })
    }
  } catch {}
  return { ...DEFAULT_SETTINGS }
}

let syncInitialized = false

/**
 * Composable for managing application settings.
 *
 * Uses useState for SSR-safe hydration (server and client agree on initial
 * values during hydration) and syncs with localStorage on the client.
 * The onPrehydrate script in prehydrate.ts handles DOM-level patches
 * (accent color, bg theme, collapsed sections, etc.) to prevent visual
 * flash before hydration.
 */
export function useSettings() {
  const settings = useState<AppSettings>(STORAGE_KEY, () => ({ ...DEFAULT_SETTINGS }))

  if (import.meta.client && !syncInitialized) {
    syncInitialized = true

    // Read localStorage eagerly but apply after mount to prevent hydration
    // mismatch. During hydration, useState provides server-matching defaults.
    // After mount, we swap in the user's actual preferences from localStorage.
    // Uses nuxtApp.hook('app:mounted') instead of onMounted so it works even
    // when useSettings() is first called from a plugin (no component context).
    const stored = readFromLocalStorage()
    const nuxtApp = useNuxtApp()

    if (nuxtApp.isHydrating) {
      nuxtApp.hook('app:mounted', () => {
        settings.value = stored
      })
    } else {
      settings.value = stored
    }

    // Persist future changes back to localStorage
    watch(
      settings,
      value => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
        } catch {}
      },
      { deep: true },
    )
  }

  return {
    settings,
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
 * Composable for accessing just the keyboard shortcuts setting.
 * Useful for components that only need to read this specific setting.
 */
export const useKeyboardShortcuts = createSharedComposable(function useKeyboardShortcuts() {
  const { settings } = useSettings()
  const enabled = computed(() => settings.value.keyboardShortcuts)

  if (import.meta.client) {
    watch(
      enabled,
      value => {
        if (value) {
          delete document.documentElement.dataset.kbdShortcuts
        } else {
          document.documentElement.dataset.kbdShortcuts = 'false'
        }
      },
      { immediate: true },
    )
  }

  return enabled
})

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
      document.documentElement.style.setProperty('--accent-color', `var(--swatch-${id})`)
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
 * Composable for managing the search provider setting.
 */
export function useSearchProvider() {
  const { settings } = useSettings()

  const searchProvider = computed({
    get: () => settings.value.searchProvider,
    set: (value: SearchProvider) => {
      settings.value.searchProvider = value
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
