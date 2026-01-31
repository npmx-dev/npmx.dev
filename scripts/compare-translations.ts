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

const addMissingKeys = (
  obj: NestedObject,
  keysToAdd: string[],
  referenceFlat: Record<string, unknown>,
): NestedObject => {
  const result: NestedObject = { ...obj }

  for (const keyPath of keysToAdd) {
    const parts = keyPath.split('.')
    let current = result

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {}
      }
      current = current[part] as NestedObject
    }

    const lastPart = parts[parts.length - 1]!
    if (!(lastPart in current)) {
      const enValue = referenceFlat[keyPath]
      current[lastPart] = `EN TEXT TO REPLACE: ${enValue}`
    }
  }

  return result
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
  referenceFlat: Record<string, unknown>,
  fix = false,
): { missing: string[]; removed: string[]; added: string[] } => {
  const filePath = join(LOCALES_DIRECTORY, localeFile)
  let content = loadJson(filePath)
  const flattenedKeys = Object.keys(flattenObject(content))

  const missingKeys = referenceKeys.filter(key => !flattenedKeys.includes(key))
  const extraneousKeys = flattenedKeys.filter(key => !referenceKeys.includes(key))

  let modified = false

  if (extraneousKeys.length > 0) {
    content = removeKeysFromObject(content, extraneousKeys)
    modified = true
  }

  if (fix && missingKeys.length > 0) {
    content = addMissingKeys(content, missingKeys, referenceFlat)
    modified = true
  }

  if (modified) {
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8')
  }

  return { missing: missingKeys, removed: extraneousKeys, added: fix ? missingKeys : [] }
}

const runSingleLocale = (
  locale: string,
  referenceKeys: string[],
  referenceFlat: Record<string, unknown>,
  fix = false,
): void => {
  const localeFile = locale.endsWith('.json') ? locale : `${locale}.json`
  const filePath = join(LOCALES_DIRECTORY, localeFile)

  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: Locale file not found: ${localeFile}${COLORS.reset}`)
    process.exit(1)
  }

  let content = loadJson(filePath)
  const flattenedKeys = Object.keys(flattenObject(content))
  const missingKeys = referenceKeys.filter(key => !flattenedKeys.includes(key))

  console.log(
    `${COLORS.cyan}=== Missing keys for ${localeFile}${fix ? ' (with --fix)' : ''} ===${COLORS.reset}`,
  )
  console.log(`Reference: ${REFERENCE_FILE_NAME} (${referenceKeys.length} keys)`)
  console.log(`Target: ${localeFile} (${flattenedKeys.length} keys)`)

  if (missingKeys.length === 0) {
    console.log(`\n${COLORS.green}No missing keys!${COLORS.reset}\n`)
  } else if (fix) {
    content = addMissingKeys(content, missingKeys, referenceFlat)
    writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8')
    console.log(
      `\n${COLORS.green}Added ${missingKeys.length} missing key(s) with EN placeholder:${COLORS.reset}`,
    )
    missingKeys.forEach(key => console.log(`  - ${key}`))
    console.log('')
  } else {
    console.log(`\n${COLORS.yellow}Missing ${missingKeys.length} key(s):${COLORS.reset}`)
    missingKeys.forEach(key => console.log(`  - ${key}`))
    console.log('')
  }
}

const runAllLocales = (
  referenceKeys: string[],
  referenceFlat: Record<string, unknown>,
  fix = false,
): void => {
  const localeFiles = readdirSync(LOCALES_DIRECTORY).filter(
    file => file.endsWith('.json') && file !== REFERENCE_FILE_NAME,
  )

  console.log(`${COLORS.cyan}=== Translation Audit${fix ? ' (with --fix)' : ''} ===${COLORS.reset}`)
  console.log(`Reference: ${REFERENCE_FILE_NAME} (${referenceKeys.length} keys)`)
  console.log(`Checking ${localeFiles.length} locale(s)...`)

  let totalMissing = 0
  let totalRemoved = 0
  let totalAdded = 0

  for (const localeFile of localeFiles) {
    const { missing, removed, added } = processLocale(localeFile, referenceKeys, referenceFlat, fix)

    if (missing.length > 0 || removed.length > 0) {
      console.log(`\n${COLORS.cyan}--- ${localeFile} ---${COLORS.reset}`)

      if (added.length > 0) {
        logSection('ADDED MISSING KEYS (with EN placeholder)', added, COLORS.green, '', '')
        totalAdded += added.length
      } else if (missing.length > 0) {
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
  if (totalAdded > 0) {
    console.log(
      `${COLORS.green}  Added missing keys (EN placeholder): ${totalAdded}${COLORS.reset}`,
    )
  }
  if (totalMissing > 0) {
    console.log(`${COLORS.yellow}  Missing keys across all locales: ${totalMissing}${COLORS.reset}`)
  }
  if (totalRemoved > 0) {
    console.log(`${COLORS.magenta}  Removed extraneous keys: ${totalRemoved}${COLORS.reset}`)
  }
  if (totalMissing === 0 && totalRemoved === 0 && totalAdded === 0) {
    console.log(`${COLORS.green}  All locales are in sync!${COLORS.reset}`)
  }
  console.log('')
}

const run = (): void => {
  const referenceFilePath = join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME)
  const referenceContent = loadJson(referenceFilePath)
  const referenceFlat = flattenObject(referenceContent)
  const referenceKeys = Object.keys(referenceFlat)

  const args = process.argv.slice(2)
  const fix = args.includes('--fix')
  const targetLocale = args.find(arg => !arg.startsWith('--'))

  if (targetLocale) {
    // Single locale mode
    runSingleLocale(targetLocale, referenceKeys, referenceFlat, fix)
  } else {
    // All locales mode: check all and remove extraneous keys
    runAllLocales(referenceKeys, referenceFlat, fix)
  }
}

run()
