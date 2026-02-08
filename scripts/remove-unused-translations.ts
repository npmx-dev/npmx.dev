/* eslint-disable no-console */
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createI18NReport, type I18NItem } from 'vue-i18n-extract'
import { colors } from './utils/colors.ts'
import { readdir, readFile, writeFile } from 'node:fs/promises'

const LOCALES_DIRECTORY = fileURLToPath(new URL('../i18n/locales', import.meta.url))
const REFERENCE_FILE_NAME = 'en.json'
const VUE_FILES_GLOB = './app/**/*.?(vue|ts|js)'

type NestedObject = Record<string, unknown>

/** Removes a key path (e.g. "foo.bar.baz") from a nested object. Cleans up empty parents. */
function removeKey(obj: NestedObject, path: string): boolean {
  const parts = path.split('.')
  if (parts.length === 1) {
    if (path in obj) {
      delete obj[path]
      return true
    }
    return false
  }
  const [first, ...rest] = parts
  const child = obj[first]
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    const removed = removeKey(child as NestedObject, rest.join('.'))
    if (removed && Object.keys(child as object).length === 0) {
      delete obj[first]
    }
    return removed
  }
  return false
}

/** Removes multiple keys from a nested object. Sorts by depth (deepest first) to avoid parent/child conflicts. */
function removeKeysFromObject(obj: NestedObject, keys: string[]): number {
  const sortedKeys = [...keys].sort((a, b) => b.split('.').length - a.split('.').length)
  let removed = 0
  for (const key of sortedKeys) {
    if (removeKey(obj, key)) removed++
  }
  return removed
}

async function run(): Promise<void> {
  console.log(colors.bold('\n🔍 Removing unused i18n translations...\n'))

  const referenceFilePath = join(LOCALES_DIRECTORY, REFERENCE_FILE_NAME)

  const { unusedKeys } = await createI18NReport({
    vueFiles: VUE_FILES_GLOB,
    languageFiles: referenceFilePath,
  })

  if (unusedKeys.length === 0) {
    console.log(colors.green('✅ No unused translations found. Nothing to remove.\n'))
    return
  }

  const uniquePaths = [...new Set(unusedKeys.map((item: I18NItem) => item.path))]

  // Remove from reference file
  const referenceContent = JSON.parse(await readFile(referenceFilePath, 'utf-8')) as NestedObject
  const refRemoved = removeKeysFromObject(referenceContent, uniquePaths)
  await writeFile(referenceFilePath, JSON.stringify(referenceContent, null, 2) + '\n', 'utf-8')

  // Remove from all other locale files
  const localeFiles = (await readdir(LOCALES_DIRECTORY)).filter(
    f => f.endsWith('.json') && f !== REFERENCE_FILE_NAME,
  )

  const otherLocalesSummary: { file: string; removed: number }[] = []
  let totalOtherRemoved = 0

  for (const localeFile of localeFiles) {
    const filePath = join(LOCALES_DIRECTORY, localeFile)
    const content = JSON.parse(await readFile(filePath, 'utf-8')) as NestedObject
    const removed = removeKeysFromObject(content, uniquePaths)
    if (removed > 0) {
      await writeFile(filePath, JSON.stringify(content, null, 2) + '\n', 'utf-8')
      otherLocalesSummary.push({ file: localeFile, removed })
      totalOtherRemoved += removed
    }
  }

  // Summary
  console.log(colors.green(`✅ Removed ${refRemoved} keys from ${REFERENCE_FILE_NAME}`))
  if (otherLocalesSummary.length > 0) {
    console.log(
      colors.green(
        `✅ Removed ${totalOtherRemoved} keys from ${otherLocalesSummary.length} other locale(s)`,
      ),
    )
    for (const { file, removed } of otherLocalesSummary) {
      console.log(colors.dim(`   ${file}: ${removed} keys`))
    }
  }
  console.log(colors.dim(`\nTotal: ${uniquePaths.length} unique unused key(s) cleaned up\n`))
}

run().catch((error: unknown) => {
  console.error(colors.red('\n❌ Unexpected error:'), error)
  process.exit(1)
})
