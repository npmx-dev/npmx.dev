import { defineConfig } from '@lunariajs/core/config'
import type { Locale, Merge } from '@lunariajs/core'
import { currentLocales, countryLocaleVariants } from './config/i18n.ts'

// The source locale is `en` (en.json contains all reference translation keys).
// Country variants like `en-US` inherit from `en` via the merge config.
const sourceLocale: Locale = { label: 'English', lang: 'en' }

// Build the list of Lunaria locales from currentLocales.
// currentLocales has expanded codes (en-US, en-GB, ar-EG, es-ES, es-419, etc.)
// but NOT the base codes (ar, es) that the variants inherit from.
// We need to add those base codes as Lunaria locales too, so they can be
// referenced in the merge config and tracked independently.
const localeSet = new Set<string>()
const locales: Locale[] = []

for (const l of currentLocales) {
  if (l.code === sourceLocale.lang || !l.name) continue
  if (!localeSet.has(l.code)) {
    localeSet.add(l.code)
    locales.push({ label: l.name, lang: l.code })
  }
}

// Add base language codes (ar, es, etc.) that aren't already in the list.
// These are the keys of countryLocaleVariants that aren't the source locale.
for (const baseLang of Object.keys(countryLocaleVariants)) {
  if (baseLang === sourceLocale.lang) continue
  if (!localeSet.has(baseLang)) {
    // Use the first variant's name or the base code as label
    const variants = countryLocaleVariants[baseLang]!
    const label = variants[0]?.name ?? baseLang
    localeSet.add(baseLang)
    locales.push({ label, lang: baseLang })
  }
}

if (locales.length === 0) {
  throw new Error('No locales found besides source locale')
}

// Build merge config from countryLocaleVariants:
// Each variant locale merges keys from its base locale, so keys present in
// the base file count as covered for the variant.
// e.g. { 'en-US': ['en'], 'en-GB': ['en'], 'ar-EG': ['ar'], 'es-ES': ['es'], 'es-419': ['es'] }
const merge: Merge = {}
for (const [baseLang, variants] of Object.entries(countryLocaleVariants)) {
  for (const variant of variants) {
    // Each variant merges from its base language and (if not the source) implicitly
    // from the source via normal Lunaria tracking.
    const existing = merge[variant.code]
    if (existing) {
      existing.push(baseLang)
    } else {
      merge[variant.code] = [baseLang]
    }
  }
}

export default defineConfig({
  repository: {
    name: 'npmx-dev/npmx.dev',
  },
  sourceLocale,
  locales: locales as [Locale, ...Locale[]],
  files: [
    {
      include: ['i18n/locales/en.json'],
      pattern: 'i18n/locales/@lang.json',
      type: 'dictionary',
      merge,
      optionalKeys: {
        $schema: true,
        vacations: true,
      },
    },
  ],
  tracking: {
    ignoredKeywords: [
      'lunaria-ignore',
      'typo',
      'en-only',
      'broken link',
      'i18nReady',
      'i18nIgnore',
    ],
  },
})
