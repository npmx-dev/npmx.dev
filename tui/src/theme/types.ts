import type { ColorInput } from '@opentui/core'

export type ThemePreference = 'system' | 'dark' | 'light'
export type ThemeMode = 'dark' | 'light'
export type ThemeName = 'default-dark' | 'default-light'

export interface Theme {
  bg: {
    base: ColorInput
    surface: ColorInput
    elevated: ColorInput
    selected: ColorInput
  }
  fg: {
    primary: ColorInput
    secondary: ColorInput
    muted: ColorInput
  }
  border: {
    normal: ColorInput
    subtle: ColorInput
    focused: ColorInput
  }
  status: {
    success: ColorInput
    warning: ColorInput
    danger: ColorInput
    info: ColorInput
  }
  accent: ColorInput
}

export interface ThemeDefinition {
  name: ThemeName
  mode: ThemeMode
  theme: Theme
}

export type ThemeSelection = Partial<Record<ThemeMode, ThemeName>>

export const themePreferences = ['system', 'dark', 'light'] as const

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && themePreferences.includes(value as ThemePreference)
}
