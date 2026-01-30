import { createLunaria } from '@lunariajs/core'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Page } from './components.ts'
import { lunariaJSONFiles, prepareJsonFiles } from './prepare-json-files.ts'
import type { I18nStatus } from '../shared/types/i18n-status.ts'

await prepareJsonFiles()

const lunaria = await createLunaria()
const status = await lunaria.getFullStatus()

// Generate HTML dashboard
const html = Page(lunaria.config, status, lunaria)

// Generate JSON status for the app
const { sourceLocale, locales } = lunaria.config
const links = lunaria.gitHostingLinks()

// For dictionary files, we track the first (and only) entry
const fileStatus = status[0]
if (!fileStatus) {
  throw new Error('No file status found')
}

// Count keys in a nested object
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

// Read source locale file from prepared files
const englishFile = JSON.parse(readFileSync('lunaria/files/en-US.json', 'utf-8')) as Record<
  string,
  unknown
>
const totalKeys = countKeys(englishFile)

const jsonStatus: I18nStatus = {
  generatedAt: new Date().toISOString(),
  sourceLocale: {
    lang: sourceLocale.lang,
    label: sourceLocale.label,
  },
  locales: locales.map(locale => {
    const localization = fileStatus.localizations.find(l => l.lang === locale.lang)

    // Get missing keys if available
    const missingKeys: string[] = []
    if (localization && 'missingKeys' in localization && localization.missingKeys) {
      for (const keyPath of localization.missingKeys) {
        missingKeys.push((keyPath as unknown as string[]).join('.'))
      }
    }

    const completedKeys = totalKeys - missingKeys.length
    const localeFilePath = `i18n/locales/${lunariaJSONFiles[locale.lang]!}.json`
    console.log(localeFilePath)

    return {
      lang: locale.lang,
      label: locale.label,
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
