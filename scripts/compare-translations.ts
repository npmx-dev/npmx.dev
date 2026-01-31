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

const flattenObject = (obj: NestedObject, prefix = ''): Record<string, unknown> => {
  return Object.keys(obj).reduce<Record<string, unknown>>((acc, key) => {
    const propertyPath = prefix ? `${prefix}.${key}` : key
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      Object.assign(acc, flattenObject(value as NestedObject, propertyPath))
    } else {
      acc[propertyPath] = value
    }
    return acc
  }, {})
}

const loadJson = (filePath: string): NestedObject => {
  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: File not found at ${filePath}${COLORS.reset}`)
    process.exit(1)
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as NestedObject
}

const removeKeysFromObject = (obj: NestedObject, keysToRemove: string[]): NestedObject => {
  const result: NestedObject = {}

  for (const key of Object.keys(obj)) {
    const value = obj[key]

    // Check if this key or any nested path starting with this key should be removed
    const shouldRemoveKey = keysToRemove.some(k => k === key || k.startsWith(`${key}.`))
    const hasNestedRemovals = keysToRemove.some(k => k.startsWith(`${key}.`))

    if (keysToRemove.includes(key)) {
      // Skip this key entirely
      continue
    }

    if (typeof value === 'object' && value !== null && !Array.isArray(value) && hasNestedRemovals) {
      // Recursively process nested objects
      const nestedKeysToRemove = keysToRemove
        .filter(k => k.startsWith(`${key}.`))
        .map(k => k.slice(key.length + 1))
      const cleaned = removeKeysFromObject(value as NestedObject, nestedKeysToRemove)
      // Only add if there are remaining keys
      if (Object.keys(cleaned).length > 0) {
        result[key] = cleaned
      }
    } else if (!shouldRemoveKey || hasNestedRemovals) {
      result[key] = value
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
  referenceKeys: string[],
): { missing: string[]; removed: string[] } => {
  const filePath = join(LOCALES_DIRECTORY, localeFile)
  const content = loadJson(filePath)
  const flattenedKeys = Object.keys(flattenObject(content))

  const missingKeys = referenceKeys.filter(key => !flattenedKeys.includes(key))
  const extraneousKeys = flattenedKeys.filter(key => !referenceKeys.includes(key))

  if (extraneousKeys.length > 0) {
    // Remove extraneous keys and write back
    const cleaned = removeKeysFromObject(content, extraneousKeys)
    writeFileSync(filePath, JSON.stringify(cleaned, null, 2) + '\n', 'utf-8')
  }

  return { missing: missingKeys, removed: extraneousKeys }
}

const runSingleLocale = (locale: string, referenceKeys: string[]): void => {
  const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`
  const filePath = join(LOCALES_DIRECTORY, localeFile)

  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: Locale file not found: ${localeFile}${COLORS.reset}`)
    process.exit(1)
  }

  const content = loadJson(filePath)
  const flattenedKeys = Object.keys(flattenObject(content))
  const missingKeys = referenceKeys.filter(key => !flattenedKeys.includes(key))

  console.log(`${COLORS.cyan}=== Missing keys for ${localeFile} ===${COLORS.reset}`)
  console.log(`Reference: ${REFERENCE_FILE_NAME} (${referenceKeys.length} keys)`)
  console.log(`Target: ${localeFile} (${flattenedKeys.length} keys)`)

  if (missingKeys.length === 0) {
    console.log(`\n${COLORS.green}No missing keys!${COLORS.reset}\n`)
  } else {
    console.log(`\n${COLORS.yellow}Missing ${missingKeys.length} key(s):${COLORS.reset}`)
    missingKeys.forEach(key => console.log(`  - ${key}`))
    console.log('')
  }
}

const runAllLocales = (referenceKeys: string[]): void => {
  const localeFiles = readdirSync(LOCALES_DIRECTORY).filter(
    file => file.endsWith('.json') && file !== REFERENCE_FILE_NAME,
  )

  console.log(`${COLORS.cyan}=== Translation Audit ===${COLORS.reset}`)
  console.log(`Reference: ${REFERENCE_FILE_NAME} (${referenceKeys.length} keys)`)
  console.log(`Checking ${localeFiles.length} locale(s)...`)

  let totalMissing = 0
  let totalRemoved = 0

  for (const localeFile of localeFiles) {
    const { missing, removed } = processLocale(localeFile, referenceKeys)

    if (missing.length > 0 || removed.length > 0) {
      console.log(`\n${COLORS.cyan}--- ${localeFile} ---${COLORS.reset}`)

      if (missing.length > 0) {
        logSection(
          'MISSING KEYS (in en.json but not in this locale)',
          missing,
          COLORS.yellow,
          '',
          '',
        )
        totalMissing += missing.length
      }

      if (removed.length > 0) {
        logSection(
          'REMOVED EXTRANEOUS KEYS (were in this locale but not in en.json)',
          removed,
          COLORS.magenta,
          '',
          '',
        )
        totalRemoved += removed.length
      }
    }
  }

  console.log(`\n${COLORS.cyan}=== Summary ===${COLORS.reset}`)
  if (totalMissing > 0) {
    console.log(`${COLORS.yellow}  Missing keys across all locales: ${totalMissing}${COLORS.reset}`)
  }
  if (totalRemoved > 0) {
    console.log(`${COLORS.magenta}  Removed extraneous keys: ${totalRemoved}${COLORS.reset}`)
  }
  if (totalMissing === 0 && totalRemoved === 0) {
    console.log(`${COLORS.green}  All locales are in sync!${COLORS.reset}`)
  }
  console.log('')
}

const run = (): void => {
  const referenceFilePath = join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME)
  const referenceContent = loadJson(referenceFilePath)
  const referenceKeys = Object.keys(flattenObject(referenceContent))

  const targetLocale = process.argv[2]

  if (targetLocale) {
    // Single locale mode: just show missing keys (no modifications)
    runSingleLocale(targetLocale, referenceKeys)
  } else {
    // All locales mode: check all and remove extraneous keys
    runAllLocales(referenceKeys)
  }
}

run()
