export { createThemeManager, DEFAULT_THEME_PREFERENCE } from './manager.ts'
export type { ThemeManager, ThemeManagerOptions, ThemeChangeListener } from './manager.ts'
export {
  defaultThemeNamesByMode,
  getThemeDefinition,
  resolveThemeDefinition,
  themeDefinitions,
} from './registry.ts'
export { darkTheme } from './themes/dark.ts'
export { lightTheme } from './themes/light.ts'
export { isThemePreference, themePreferences } from './types.ts'
export type {
  Theme,
  ThemeDefinition,
  ThemeMode,
  ThemeName,
  ThemePreference,
  ThemeSelection,
} from './types.ts'
