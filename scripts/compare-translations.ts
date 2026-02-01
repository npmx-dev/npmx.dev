/* eslint-disable no-console */
import process from 'node:process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOCALES_DIRECTORY = fileURLToPath(new URL('../i18n/locales', import.meta.url))
const REFERENCE_FILE_NAME = 'en.json'

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
} as const

type NestedObject = { [key: string]: unknown }

const loadJson = (filePath: string): NestedObject => {
  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: File not found at ${filePath}${COLORS.reset}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as NestedObject
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
      result[key] = syncLocaleData(refValue, nextTarget, stats, fix, propertyPath)
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

const processLocale = (
  localeFile: string,
  referenceContent: NestedObject,
  fix = false,
): SyncStats => {
  const filePath = join(LOCALES_DIRECTORY, localeFile)
  const targetContent = loadJson(filePath)

  const stats: SyncStats = {
    missing: [],
    extra: [],
    referenceKeys: [],
  }

  const newContent = syncLocaleData(referenceContent, targetContent, stats, fix)

  // Write if there are removals (always) or we are in fix mode
  if (stats.extra.length > 0 || fix) {
    writeFileSync(filePath, JSON.stringify(newContent, null, 2) + '\n', 'utf-8')
  }

  return stats
}

const runSingleLocale = (locale: string, referenceContent: NestedObject, fix = false): void => {
  const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`
  const filePath = join(LOCALES_DIRECTORY, localeFile)

  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: Locale file not found: ${localeFile}${COLORS.reset}`)
    process.exit(1)
  }

  const { missing, extra, referenceKeys } = processLocale(localeFile, referenceContent, fix)

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

const runAllLocales = (referenceContent: NestedObject, fix = false): void => {
  const localeFiles = readdirSync(LOCALES_DIRECTORY).filter(
    file => file.endsWith('.json') && file !== REFERENCE_FILE_NAME,
  )

  const results: (SyncStats & { file: string })[] = []

  let totalMissing = 0
  let totalRemoved = 0
  let totalAdded = 0

  for (const localeFile of localeFiles) {
    const stats = processLocale(localeFile, referenceContent, fix)
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

const run = (): void => {
  const referenceFilePath = join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME)
  const referenceContent = loadJson(referenceFilePath)

  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const targetLocale = args.find(arg => !arg.startsWith('--'))

  if (targetLocale) {
    // Single locale mode
    runSingleLocale(targetLocale, referenceContent, fix)
  } else {
    // All locales mode: check all and remove extraneous keys
    runAllLocales(referenceContent, fix)
  }
}

run()
