/* eslint-disable no-console */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createI18NReport, type I18NItem } from 'vue-i18n-extract'

const LOCALES_DIRECTORY = fileURLToPath(new URL('../i18n/locales', import.meta.url))
const REFERENCE_FILE_NAME = 'en.json'
const VUE_FILES_GLOB = './app/**/*.?(vue|ts|js)'

const colors = {
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  cyan: (text: string) => `\x1b[36m${text}\x1b[0m`,
  dim: (text: string) => `\x1b[2m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
}

function printSection(
  title: string,
  items: I18NItem[],
  status: 'error' | 'warning' | 'success',
): void {
  const icon = status === 'error' ? '❌' : status === 'warning' ? '⚠️' : '✅'
  const colorFn =
    status === 'error' ? colors.red : status === 'warning' ? colors.yellow : colors.green

  console.log(`\n${icon} ${colors.bold(title)}: ${colorFn(String(items.length))}`)

  if (items.length === 0) return

  const groupedByFile = items.reduce<Record<string, string[]>>((acc, item) => {
    const file = item.file ?? 'unknown'
    acc[file] ??= []
    acc[file].push(item.path)
    return acc
  }, {})

  for (const [file, keys] of Object.entries(groupedByFile)) {
    console.log(`  ${colors.dim(file)}`)
    for (const key of keys) {
      console.log(`    ${colors.cyan(key)}`)
    }
  }
}

async function run(): Promise<void> {
  console.log(colors.bold('\n🔍 Analyzing i18n translations...\n'))

  const { missingKeys, unusedKeys, maybeDynamicKeys } = await createI18NReport({
    vueFiles: VUE_FILES_GLOB,
    languageFiles: join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME),
  })

  const hasMissingKeys = missingKeys.length > 0
  const hasUnusedKeys = unusedKeys.length > 0
  const hasDynamicKeys = maybeDynamicKeys.length > 0

  // Display missing keys (critical - causes build failure)
  printSection('Missing keys', missingKeys, hasMissingKeys ? 'error' : 'success')

  // Display dynamic keys (critical - causes build failure)
  printSection(
    'Dynamic keys (cannot be statically analyzed)',
    maybeDynamicKeys,
    hasDynamicKeys ? 'error' : 'success',
  )

  // Display unused keys (warning only - does not cause build failure)
  printSection('Unused keys', unusedKeys, hasUnusedKeys ? 'warning' : 'success')

  // Summary
  console.log('\n' + colors.dim('─'.repeat(50)))

  const shouldFail = hasMissingKeys || hasDynamicKeys

  if (shouldFail) {
    console.log(colors.red('\n❌ Build failed: missing or dynamic keys detected'))
    console.log(colors.dim('   Fix missing keys by adding them to the locale file'))
    console.log(colors.dim('   Fix dynamic keys by using static translation keys\n'))
    process.exit(1)
  }

  if (hasUnusedKeys) {
    console.log(colors.yellow('\n⚠️  Build passed with warnings: unused keys detected'))
    console.log(colors.dim('   Consider removing unused keys from locale files\n'))
  } else {
    console.log(colors.green('\n✅ All translations are valid!\n'))
  }
}

run().catch((error: unknown) => {
  console.error(colors.red('\n❌ Unexpected error:'), error)
  process.exit(1)
})
