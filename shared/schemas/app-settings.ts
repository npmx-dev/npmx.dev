import * as v from 'valibot'
import { ACCENT_COLORS, BACKGROUND_THEMES } from '#shared/utils/constants'

type AccentColorKey = keyof typeof ACCENT_COLORS.light
type BackgroundThemeKey = keyof typeof BACKGROUND_THEMES

const accentColorIds = Object.keys(ACCENT_COLORS.light) as [AccentColorKey, ...AccentColorKey[]]
const backgroundThemeIds = Object.keys(BACKGROUND_THEMES) as [
  BackgroundThemeKey,
  ...BackgroundThemeKey[],
]

export const AppSettingsSchema = v.object({
  theme: v.picklist(['light', 'dark', 'system']),
  relativeDates: v.boolean(),
  includeTypesInInstall: v.boolean(),
  accentColorId: v.nullable(v.picklist(accentColorIds)),
  preferredBackgroundTheme: v.nullable(v.picklist(backgroundThemeIds)),
  hidePlatformPackages: v.boolean(),
  selectedLocale: v.nullable(v.string()),
  sidebar: v.object({
    collapsed: v.array(v.string()),
  }),
})

export type AppSettings = v.InferOutput<typeof AppSettingsSchema>
export type AccentColorId = AppSettings['accentColorId']
export type BackgroundThemeId = AppSettings['preferredBackgroundTheme']
