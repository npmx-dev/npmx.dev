import { createLunaria } from '@lunariajs/core'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Page } from './components.ts'
import { countryLocaleVariants, currentLocales } from '../config/i18n.ts'
import type { I18nStatus } from '../shared/types/i18n-status.ts'

// skip lunaria during git merges as git history may be in an inconsistent state.
if (existsSync('.git/MERGE_HEAD')) {
  // eslint-disable-next-line no-console
  console.log('Skipping lunaria: git merge in progress')
  process.exit(0)
}

const lunaria = await createLunaria()
const status = await lunaria.getFullStatus()

// Generate HTML dashboard
const html = Page(lunaria.config, status, lunaria)

// Generate JSON status for the app
const { sourceLocale } = lunaria.config
const links = lunaria.gitHostingLinks()

// For dictionary files, we track the first (and only) entry
const fileStatus = status[0]
if (!fileStatus) {
  throw new Error('No file status found')
}

// Count keys in the source locale file (en.json), excluding non-translation keys.
function countKeys(obj: Record<string, unknown>): number {
  let count = 0
  for (const key in obj) {
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      count += countKeys(value as Record<string, unknown>)
    } else {
      count++
    }
  }
  return count
}

const sourceContent = JSON.parse(readFileSync('i18n/locales/en.json', 'utf-8'))
const { $schema: _, vacations: __, ...sourceWithoutMeta } = sourceContent
const totalKeys = countKeys(sourceWithoutMeta)

// Build a mapping from locale code to the primary file translators should edit.
// Country variants (e.g. ar-EG, es-ES) point to the base file (ar.json, es.json).
// Non-country variants (e.g. en-GB, es-419) point to their own file.
// Standalone locales (e.g. de-DE, fr-FR) point to their own file.
const localeToFile: Record<string, string> = {}
for (const locale of currentLocales) {
  let found = false
  for (const [baseLang, variants] of Object.entries(countryLocaleVariants)) {
    const variant = variants.find(v => v.code === locale.code)
    if (variant) {
      localeToFile[locale.code] = variant.country ? `${baseLang}.json` : `${locale.code}.json`
      found = true
      break
    }
  }
  if (!found) {
    localeToFile[locale.code] = (locale.file as string) ?? `${locale.code}.json`
  }
}

// Only output status for locales in currentLocales (the app-facing locales).
// Lunaria also tracks base language codes (ar, es) but those are internal to
// the merge config and not visible in the app.
const appLocales = currentLocales.filter(l => l.code !== sourceLocale.lang && l.name)

const jsonStatus: I18nStatus = {
  generatedAt: new Date().toISOString(),
  sourceLocale: {
    lang: sourceLocale.lang,
    label: sourceLocale.label,
  },
  locales: appLocales.map(locale => {
    const localization = fileStatus.localizations.find(l => l.lang === locale.code)

    // Get missing keys if available
    const missingKeys: string[] = []
    if (localization && 'missingKeys' in localization && localization.missingKeys) {
      for (const keyPath of localization.missingKeys) {
        missingKeys.push((keyPath as unknown as string[]).join('.'))
      }
    }

    const completedKeys = totalKeys - missingKeys.length
    const localeFilePath = `i18n/locales/${localeToFile[locale.code]!}`

    return {
      lang: locale.code,
      label: locale.name!,
      totalKeys,
      completedKeys,
      missingKeys,
      percentComplete: totalKeys > 0 ? Math.round((completedKeys / totalKeys) * 100) : 100,
      githubEditUrl: links.source(localeFilePath),
      githubHistoryUrl: links.history(localeFilePath),
    }
  }),
}

mkdirSync('dist/lunaria', { recursive: true })
writeFileSync('dist/lunaria/index.html', html)
writeFileSync('dist/lunaria/status.json', JSON.stringify(jsonStatus, null, 2))

// eslint-disable-next-line no-console
console.log('Generated dist/lunaria/index.html and dist/lunaria/status.json')
