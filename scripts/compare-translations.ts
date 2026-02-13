/* eslint-disable no-console */
import type { LocaleObject } from '@nuxtjs/i18n'
import * as process from 'node:process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { countryLocaleVariants, currentLocales } from '../config/i18n.ts'
import { mergeLocaleObject } from '../lunaria/prepare-json-files.ts'
import { COLORS } from './utils.ts'

const LOCALES_DIRECTORY = fileURLToPath(new URL('../i18n/locales', import.meta.url))
const REFERENCE_FILE_NAME = 'en.json'

type NestedObject = { [key: string]: unknown }
interface LocaleInfo {
  filePath: string
  locale: string
  lang: string
  country?: string
  forCountry?: boolean
  mergeLocale?: boolean
}

const countries = new Map<string, Map<string, LocaleInfo>>()
const availableLocales = new Map<string, LocaleObject>()

function extractLocalInfo(filePath: string): LocaleInfo {
  const locale = basename(filePath, '.json')
  const [lang, country] = locale.split('-')
  return { filePath, locale, lang, country }
}

function createVariantInfo(
  code: string,
  options: { forCountry: boolean; mergeLocale: boolean },
): LocaleInfo {
  const [lang, country] = code.split('-')
  return { filePath: '', locale: code, lang, country, ...options }
}

const populateLocaleCountries = (): void => {
  for (const lang of Object.keys(countryLocaleVariants)) {
    const variants = countryLocaleVariants[lang]
    for (const variant of variants) {
      if (!countries.has(lang)) {
        countries.set(lang, new Map())
      }
      if (variant.country) {
        countries
          .get(lang)!
          .set(lang, createVariantInfo(lang, { forCountry: true, mergeLocale: false }))
        countries
          .get(lang)!
          .set(
            variant.code,
            createVariantInfo(variant.code, { forCountry: true, mergeLocale: true }),
          )
      } else {
        countries
          .get(lang)!
          .set(
            variant.code,
            createVariantInfo(variant.code, { forCountry: false, mergeLocale: true }),
          )
      }
    }
  }

  for (const localeData of currentLocales) {
    availableLocales.set(localeData.code, localeData)
  }
}

/**
 * We use ISO 639-1 for the language and ISO 3166-1 for the country (e.g. es-ES), we're preventing here:
 * using the language as the JSON file name when there is no country variant.
 *
 * For example, `az.json` is wrong, should be `az-AZ.json` since it is not included at `countryLocaleVariants`.
 */
const checkCountryVariant = (localeInfo: LocaleInfo): void => {
  const { locale, lang, country } = localeInfo
  const countryVariant = countries.get(lang)
  if (countryVariant) {
    if (country) {
      const found = countryVariant.get(locale)
      if (!found) {
        console.error(
          `${COLORS.red}Error: Invalid locale file "${locale}", it should be included at "countryLocaleVariants" in config/i18n.ts"${COLORS.reset}`,
        )
        process.exit(1)
      }
      localeInfo.forCountry = found.forCountry
      localeInfo.mergeLocale = found.mergeLocale
    } else {
      localeInfo.forCountry = false
      localeInfo.mergeLocale = false
    }
  } else {
    if (!country) {
      console.error(
        `${COLORS.red}Error: Invalid locale file "${locale}", it should be included at "countryLocaleVariants" in config/i18n.ts, or change the name to include country name "${lang}-<country-name>"${COLORS.reset}`,
      )
      process.exit(1)
    }
  }
}

const checkJsonName = (filePath: string): LocaleInfo => {
  const info = extractLocalInfo(filePath)
  checkCountryVariant(info)
  return info
}

const loadJson = async ({ filePath, mergeLocale, locale }: LocaleInfo): Promise<NestedObject> => {
  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: File not found at ${filePath}${COLORS.reset}`)
    process.exit(1)
  }

  if (!mergeLocale) {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as NestedObject
  }

  const localeObject = availableLocales.get(locale)
  if (!localeObject) {
    console.error(
      `${COLORS.red}Error: Locale "${locale}" not found in currentLocales${COLORS.reset}`,
    )
    process.exit(1)
  }
  const merged = await mergeLocaleObject(localeObject)
  if (!merged) {
    console.error(`${COLORS.red}Error: Failed to merge locale "${locale}"${COLORS.reset}`)
    process.exit(1)
  }
  return merged
}

type SyncStats = {
  missing: string[]
  extra: string[]
  referenceKeys: string[]
}

// Check if value is a non-null object and not array
const isNested = (val: unknown): val is NestedObject =>
  val !== null && typeof val === 'object' && !Array.isArray(val)

const syncLocaleData = (
  reference: NestedObject,
  target: NestedObject,
  stats: SyncStats,
  fix: boolean,
  prefix = '',
): NestedObject => {
  const result: NestedObject = {}

  for (const key of Object.keys(reference)) {
    const propertyPath = prefix ? `${prefix}.${key}` : key
    const refValue = reference[key]

    if (isNested(refValue)) {
      const nextTarget = isNested(target[key]) ? target[key] : {}
      const data = syncLocaleData(refValue, nextTarget, stats, fix, propertyPath)
      // When fixing, empty objects won't occur since missing keys get placeholders.
      // Without --fix, keep empty objects to preserve structural parity with the reference.
      if (fix && Object.keys(data).length === 0) {
        delete result[key]
      } else {
        result[key] = data
      }
    } else {
      stats.referenceKeys.push(propertyPath)

      if (key in target) {
        result[key] = target[key]
      } else {
        stats.missing.push(propertyPath)
        if (fix) {
          result[key] = `EN TEXT TO REPLACE: ${refValue}`
        }
      }
    }
  }

  for (const key of Object.keys(target)) {
    const propertyPath = prefix ? `${prefix}.${key}` : key
    if (!(key in reference)) {
      stats.extra.push(propertyPath)
    }
  }

  return result
}

const logSection = (
  title: string,
  keys: string[],
  color: string,
  icon: string,
  emptyMessage: string,
): void => {
  console.log(`\n${color}${icon} ${title}${COLORS.reset}`)
  if (keys.length === 0) {
    console.log(`  ${COLORS.green}${emptyMessage}${COLORS.reset}`)
    return
  }
  keys.forEach(key => console.log(`  - ${key}`))
}

const processLocale = async (
  singleLocale: boolean,
  localeFile: string,
  referenceContent: NestedObject,
  fix = false,
): Promise<SyncStats> => {
  const filePath = join(LOCALES_DIRECTORY, localeFile)
  const localeInfo = checkJsonName(filePath)

  // prevent updating wrong locale file:
  // - language locale files at countries allowed: e.g. es.json
  // - country locale file forbidden: e.g. es-ES.json
  // - target locale file forbidden: e.g. es-419.json
  if (fix && localeInfo.mergeLocale && singleLocale) {
    console.error(
      `${COLORS.red}Error: Locale "${localeInfo.locale}" cannot be fixed, fix the ${localeInfo.lang} locale instead!${COLORS.reset}`,
    )
    process.exit(1)
  }

  const targetContent = await loadJson(localeInfo)

  // $schema is a JSON Schema reference, not a translation key — preserve it but exclude from comparison
  const { $schema: targetSchema, ...targetWithoutSchema } = targetContent

  const stats: SyncStats = {
    missing: [],
    extra: [],
    referenceKeys: [],
  }

  const newContent = syncLocaleData(referenceContent, targetWithoutSchema, stats, fix)

  // Write if there are removals (always) or we are in fix mode
  if (!localeInfo.mergeLocale && (stats.extra.length > 0 || fix)) {
    const output = targetSchema ? { $schema: targetSchema, ...newContent } : newContent
    writeFileSync(filePath, JSON.stringify(output, null, 2) + '\n', 'utf-8')
  }

  return stats
}

const runSingleLocale = async (
  locale: string,
  referenceContent: NestedObject,
  fix = false,
): Promise<void> => {
  const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`
  const filePath = join(LOCALES_DIRECTORY, localeFile)

  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: Locale file not found: ${localeFile}${COLORS.reset}`)
    process.exit(1)
  }

  const { missing, extra, referenceKeys } = await processLocale(
    true,
    localeFile,
    referenceContent,
    fix,
  )

  console.log(
    `${COLORS.cyan}=== Missing keys for ${localeFile}${fix ? ' (with --fix)' : ''} ===${COLORS.reset}`,
  )
  console.log(`Reference: ${REFERENCE_FILE_NAME} (${referenceKeys.length} keys)`)

  if (missing.length > 0) {
    if (fix) {
      console.log(
        `\n${COLORS.green}Added ${missing.length} missing key(s) with EN placeholder:${COLORS.reset}`,
      )
      missing.forEach(key => console.log(`  - ${key}`))
    } else {
      console.log(`\n${COLORS.yellow}Missing ${missing.length} key(s):${COLORS.reset}`)
      missing.forEach(key => console.log(`  - ${key}`))
    }
  } else {
    console.log(`\n${COLORS.green}No missing keys!${COLORS.reset}`)
  }

  if (extra.length > 0) {
    console.log(`\n${COLORS.magenta}Removed ${extra.length} extra key(s):${COLORS.reset}`)
    extra.forEach(key => console.log(`  - ${key}`))
  }
  console.log('')
}

const runAllLocales = async (referenceContent: NestedObject, fix = false): Promise<void> => {
  const localeFiles = readdirSync(LOCALES_DIRECTORY).filter(
    file => file.endsWith('.json') && file !== REFERENCE_FILE_NAME,
  )

  const results: (SyncStats & { file: string })[] = []

  let totalMissing = 0
  let totalRemoved = 0
  let totalAdded = 0

  for (const localeFile of localeFiles) {
    const stats = await processLocale(false, localeFile, referenceContent, fix)
    results.push({
      file: localeFile,
      ...stats,
    })

    if (fix) {
      if (stats.missing.length > 0) totalAdded += stats.missing.length
    } else {
      if (stats.missing.length > 0) totalMissing += stats.missing.length
    }
    if (stats.extra.length > 0) totalRemoved += stats.extra.length
  }

  const referenceKeysCount = results.length > 0 ? results[0]!.referenceKeys.length : 0

  console.log(`${COLORS.cyan}=== Translation Audit${fix ? ' (with --fix)' : ''} ===${COLORS.reset}`)
  console.log(`Reference: ${REFERENCE_FILE_NAME} (${referenceKeysCount} keys)`)
  console.log(`Checking ${localeFiles.length} locale(s)...`)

  for (const res of results) {
    if (res.missing.length > 0 || res.extra.length > 0) {
      console.log(`\n${COLORS.cyan}--- ${res.file} ---${COLORS.reset}`)

      if (res.missing.length > 0) {
        if (fix) {
          logSection('ADDED MISSING KEYS (with EN placeholder)', res.missing, COLORS.green, '', '')
        } else {
          logSection(
            'MISSING KEYS (in en.json but not in this locale)',
            res.missing,
            COLORS.yellow,
            '',
            '',
          )
        }
      }

      if (res.extra.length > 0) {
        logSection(
          'REMOVED EXTRA KEYS (were in this locale but not in en.json)',
          res.extra,
          COLORS.magenta,
          '',
          '',
        )
      }
    }
  }

  console.log(`\n${COLORS.cyan}=== Summary ===${COLORS.reset}`)
  if (totalAdded > 0) {
    console.log(
      `${COLORS.green}  Added missing keys (EN placeholder): ${totalAdded}${COLORS.reset}`,
    )
  }
  if (totalMissing > 0) {
    console.log(`${COLORS.yellow}  Missing keys across all locales: ${totalMissing}${COLORS.reset}`)
  }
  if (totalRemoved > 0) {
    console.log(`${COLORS.magenta}  Removed extra keys: ${totalRemoved}${COLORS.reset}`)
  }
  if (totalMissing === 0 && totalRemoved === 0 && totalAdded === 0) {
    console.log(`${COLORS.green}  All locales are in sync!${COLORS.reset}`)
  }
  console.log('')
}

const run = async (): Promise<void> => {
  populateLocaleCountries()
  const referenceFilePath = join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME)
  const referenceContent = await loadJson({
    filePath: referenceFilePath,
    locale: 'en',
    lang: 'en',
  })

  // TODO: removing vacations entry key for temporal recharging page
  delete referenceContent.vacations

  // $schema is a JSON Schema reference, not a translation key
  delete referenceContent.$schema

  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const targetLocale = args.find(arg => !arg.startsWith('--'))

  if (targetLocale) {
    // Single locale mode
    await runSingleLocale(targetLocale, referenceContent, fix)
  } else {
    // All locales mode: check all and remove extraneous keys
    await runAllLocales(referenceContent, fix)
  }
}

await run()
