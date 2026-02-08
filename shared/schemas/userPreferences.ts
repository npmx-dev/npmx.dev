import { object, string, boolean, nullable, optional, picklist, type InferOutput } from 'valibot'
import { ACCENT_COLORS, BACKGROUND_THEMES } from '#shared/utils/constants'

const AccentColorIdSchema = picklist(Object.keys(ACCENT_COLORS.light) as [string, ...string[]])

const BackgroundThemeIdSchema = picklist(Object.keys(BACKGROUND_THEMES) as [string, ...string[]])

export const UserPreferencesSchema = object({
  /** Display dates as relative (e.g., "3 days ago") instead of absolute */
  relativeDates: optional(boolean()),
  /** Include @types/* package in install command for packages without built-in types */
  includeTypesInInstall: optional(boolean()),
  /** Accent color theme ID (e.g., "rose", "amber", "emerald") */
  accentColorId: optional(nullable(AccentColorIdSchema)),
  /** Preferred background shade */
  preferredBackgroundTheme: optional(nullable(BackgroundThemeIdSchema)),
  /** Hide platform-specific packages (e.g., @scope/pkg-linux-x64) from search results */
  hidePlatformPackages: optional(boolean()),
  /** User-selected locale code (e.g., "en", "de", "ja") */
  selectedLocale: optional(nullable(string())),
  /** Timestamp of last update (ISO 8601) - managed by server */
  updatedAt: optional(string()),
})

export type UserPreferences = InferOutput<typeof UserPreferencesSchema>

export type AccentColorId = keyof typeof ACCENT_COLORS.light
export type BackgroundThemeId = keyof typeof BACKGROUND_THEMES

/**
 * Default user preferences.
 * Used when creating new user preferences or merging with partial updates.
 */
export const DEFAULT_USER_PREFERENCES: Required<Omit<UserPreferences, 'updatedAt'>> = {
  relativeDates: false,
  includeTypesInInstall: true,
  accentColorId: null,
  preferredBackgroundTheme: null,
  hidePlatformPackages: true,
  selectedLocale: null,
}

export const USER_PREFERENCES_STORAGE_BASE = 'npmx-kv-user-preferences'
