import process from 'node:process'
import {
  CliRenderEvents,
  type CliRenderer,
  type ThemeMode as OpenTuiThemeMode,
} from '@opentui/core'
import { resolveThemeDefinition } from './registry.ts'
import type {
  Theme,
  ThemeDefinition,
  ThemeMode,
  ThemeName,
  ThemePreference,
  ThemeSelection,
} from './types.ts'

export interface ThemeManagerOptions {
  preference?: ThemePreference
  fallbackMode?: ThemeMode
  detectionTimeoutMs?: number
  themeSelection?: ThemeSelection
}

export type ThemeChangeListener = (
  theme: Theme,
  resolvedMode: ThemeMode,
  definition: ThemeDefinition,
) => void

export interface ThemeManager {
  readonly preference: ThemePreference
  readonly terminalMode: ThemeMode
  readonly resolvedMode: ThemeMode
  readonly themeDefinition: ThemeDefinition
  readonly theme: Theme
  detectTerminalMode: (timeoutMs?: number) => Promise<ThemeMode>
  setPreference: (preference: ThemePreference) => void
  setThemeName: (mode: ThemeMode, themeName: ThemeName) => void
  subscribe: (listener: ThemeChangeListener) => () => void
  dispose: () => void
}

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'
export const DEFAULT_THEME_DETECTION_TIMEOUT_MS = 500

export async function createThemeManager(
  renderer: CliRenderer,
  options: ThemeManagerOptions = {},
): Promise<ThemeManager> {
  let preference = options.preference ?? DEFAULT_THEME_PREFERENCE
  let terminalMode =
    normalizeThemeMode(renderer.themeMode) ??
    inferThemeModeFromColorFgBg() ??
    options.fallbackMode ??
    'dark'

  const listeners = new Set<ThemeChangeListener>()
  const themeSelection: ThemeSelection = { ...options.themeSelection }

  function getResolvedMode(): ThemeMode {
    return preference === 'system' ? terminalMode : preference
  }

  function getThemeDefinition(): ThemeDefinition {
    return resolveThemeDefinition(getResolvedMode(), themeSelection)
  }

  function emitChange(): void {
    const definition = getThemeDefinition()

    for (const listener of listeners) {
      listener(definition.theme, getResolvedMode(), definition)
    }

    renderer.requestRender()
  }

  function emitIfResolvedThemeChanged(previousThemeName: ThemeName): void {
    if (getThemeDefinition().name !== previousThemeName) {
      emitChange()
    }
  }

  const terminalThemeModeListener = (mode: OpenTuiThemeMode): void => {
    const previousThemeName = getThemeDefinition().name
    terminalMode = mode
    emitIfResolvedThemeChanged(previousThemeName)
  }

  renderer.on(CliRenderEvents.THEME_MODE, terminalThemeModeListener)

  const manager: ThemeManager = {
    get preference() {
      return preference
    },

    get terminalMode() {
      return terminalMode
    },

    get resolvedMode() {
      return getResolvedMode()
    },

    get themeDefinition() {
      return getThemeDefinition()
    },

    get theme() {
      return getThemeDefinition().theme
    },

    async detectTerminalMode(timeoutMs = DEFAULT_THEME_DETECTION_TIMEOUT_MS) {
      const previousThemeName = getThemeDefinition().name
      const detectedMode =
        normalizeThemeMode(renderer.themeMode) ??
        normalizeThemeMode(await renderer.waitForThemeMode(timeoutMs))

      if (detectedMode) {
        terminalMode = detectedMode
        emitIfResolvedThemeChanged(previousThemeName)
      }

      return terminalMode
    },

    setPreference(nextPreference) {
      if (preference === nextPreference) {
        return
      }

      const previousThemeName = getThemeDefinition().name
      preference = nextPreference
      emitIfResolvedThemeChanged(previousThemeName)
    },

    setThemeName(mode, themeName) {
      const definition = resolveThemeDefinition(mode, { [mode]: themeName })

      if (definition.name !== themeName) {
        throw new Error(`Theme "${themeName}" is not registered for ${mode} mode`)
      }

      if (themeSelection[mode] === themeName) {
        return
      }

      const previousThemeName = getThemeDefinition().name
      themeSelection[mode] = themeName
      emitIfResolvedThemeChanged(previousThemeName)
    },

    subscribe(listener) {
      listeners.add(listener)

      return () => {
        listeners.delete(listener)
      }
    },

    dispose() {
      renderer.off(CliRenderEvents.THEME_MODE, terminalThemeModeListener)
      listeners.clear()
    },
  }

  await manager.detectTerminalMode(options.detectionTimeoutMs)

  return manager
}

function normalizeThemeMode(mode: OpenTuiThemeMode | null | undefined): ThemeMode | null {
  return mode === 'dark' || mode === 'light' ? mode : null
}

function inferThemeModeFromColorFgBg(value = process.env.COLORFGBG): ThemeMode | null {
  if (!value) {
    return null
  }

  const backgroundCode = Number(value.split(';').at(-1))

  if (!Number.isFinite(backgroundCode)) {
    return null
  }

  return backgroundCode >= 7 && backgroundCode <= 15 ? 'light' : 'dark'
}
