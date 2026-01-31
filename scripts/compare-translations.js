import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

const LOCALES_DIRECTORY = join(process.cwd(), 'i18n/locales')
const REFERENCE_FILE_NAME = 'en.json'
const TARGET_LOCALE_CODE = process.argv[2]

const COLORS = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

const validateInput = () => {
  if (!TARGET_LOCALE_CODE) {
    console.error(
      `${COLORS.red}Error: Missing locale argument. Usage: pnpm i18n:check <locale>${COLORS.reset}`,
    )
    process.exit(1)
  }
}

const flattenObject = (obj, prefix = '') => {
  return Object.keys(obj).reduce((acc, key) => {
    const propertyPath = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], propertyPath))
    } else {
      acc[propertyPath] = obj[key]
    }
    return acc
  }, {})
}

const loadAndFlatten = locale => {
  const filePath = join(LOCALES_DIRECTORY, locale.endsWith('.json') ? locale : `${locale}.json`)
  if (!existsSync(filePath)) {
    console.error(`${COLORS.red}Error: File not found at ${filePath}${COLORS.reset}`)
    process.exit(1)
  }
  const content = JSON.parse(readFileSync(filePath, 'utf-8'))
  return Object.keys(flattenObject(content))
}

const logSection = (title, keys, color, icon, emptyMessage) => {
  console.log(`\n${color}${icon} ${title}${COLORS.reset}`)
  if (keys.length === 0) {
    console.log(`  ${COLORS.green}${emptyMessage}${COLORS.reset}`)
    return
  }
  keys.forEach(key => console.log(`  - ${key}`))
}

const run = () => {
  validateInput()

  const referenceKeys = loadAndFlatten(REFERENCE_FILE_NAME)
  const targetKeys = loadAndFlatten(TARGET_LOCALE_CODE)

  const missingKeys = referenceKeys.filter(key => !targetKeys.includes(key))
  const extraneousKeys = targetKeys.filter(key => !referenceKeys.includes(key))

  console.log(
    `\n${COLORS.cyan}=== Deep Translation Audit: ${TARGET_LOCALE_CODE} ===${COLORS.reset}`,
  )

  logSection(
    'MISSING KEYS (Path exists in en.json but not in target)',
    missingKeys,
    COLORS.yellow,
    '⚠️ ',
    'No missing keys found.',
  )

  logSection(
    'EXTRANEOUS KEYS (Path exists in target but not in en.json)',
    extraneousKeys,
    COLORS.magenta,
    '🗑️ ',
    'No extraneous keys found.',
  )

  console.log(`\n${COLORS.cyan}==========================================${COLORS.reset}\n`)
}

run()
