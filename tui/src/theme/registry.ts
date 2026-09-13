import { darkTheme } from './themes/dark.ts'
import { lightTheme } from './themes/light.ts'
import type { ThemeDefinition, ThemeMode, ThemeName, ThemeSelection } from './types.ts'

export const defaultThemeNamesByMode = {
  dark: 'default-dark',
  light: 'default-light',
} as const satisfies Record<ThemeMode, ThemeName>

export const themeDefinitions = {
  'default-dark': {
    name: 'default-dark',
    mode: 'dark',
    theme: darkTheme,
  },
  'default-light': {
    name: 'default-light',
    mode: 'light',
    theme: lightTheme,
  },
} as const satisfies Record<ThemeName, ThemeDefinition>

export function getThemeDefinition(themeName: ThemeName): ThemeDefinition {
  return themeDefinitions[themeName]
}

export function resolveThemeDefinition(
  mode: ThemeMode,
  selection: ThemeSelection = {},
): ThemeDefinition {
  const selectedThemeName = selection[mode] ?? defaultThemeNamesByMode[mode]
  const selectedTheme = getThemeDefinition(selectedThemeName)

  return selectedTheme.mode === mode
    ? selectedTheme
    : getThemeDefinition(defaultThemeNamesByMode[mode])
}
