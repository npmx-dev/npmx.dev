import type { LocaleObject } from '@nuxtjs/i18n'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { currentLocales, lunariaJSONFiles } from '../config/i18n.ts'
import { deepCopy } from '@intlify/shared'

const destFolder = path.resolve('lunaria/files')
const localesFolder = path.resolve('i18n/locales')

const defaultLocale = currentLocales.find(l => l.code === 'en-US')
if (!defaultLocale?.name) {
  throw new Error('Default locale en-US not found or has no name')
}
export { lunariaJSONFiles }
export const sourceLocale = {
  label: defaultLocale.name,
  lang: defaultLocale.code,
}
const filteredLocales = currentLocales.filter(
  (l): l is typeof l & { name: string } => l.code !== 'en-US' && typeof l.name === 'string',
)
const firstLocale = filteredLocales[0]
if (!firstLocale) {
  throw new Error('No locales found besides en-US')
}
export const locales: [{ label: string; lang: string }, ...{ label: string; lang: string }[]] = [
  { label: firstLocale.name, lang: firstLocale.code },
  ...filteredLocales.slice(1).map(l => ({
    label: l.name,
    lang: l.code,
  })),
]

export async function prepareJsonFiles(): Promise<void> {
  await fs.rm(destFolder, { recursive: true, force: true })
  await fs.mkdir(destFolder)
  await Promise.all(currentLocales.map(l => mergeLocale(l)))
}

type NestedObject = Record<string, unknown>

export async function mergeLocaleObject(
  locale: LocaleObject,
  options: { copy?: boolean } = {},
): Promise<NestedObject | undefined> {
  const { copy = false } = options
  const files = locale.files ?? []
  if (locale.file || files.length === 1) {
    const json =
      (locale.file ? getFileName(locale.file) : undefined) ??
      (files[0] ? getFileName(files[0]) : undefined)
    if (!json) return undefined
    if (copy) {
      await fs.cp(path.resolve(`${localesFolder}/${json}`), path.resolve(`${destFolder}/${json}`))
      return undefined
    }

    return await loadJsonFile<NestedObject>(json)
  }

  const firstFile = files[0]
  if (!firstFile) return undefined
  const source = await loadJsonFile<NestedObject>(getFileName(firstFile))
  let currentSource: unknown
  for (let i = 1; i < files.length; i++) {
    const file = files[i]
    if (!file) continue
    currentSource = await loadJsonFile(getFileName(file))
    deepCopy(currentSource, source)
  }

  return source
}

async function loadJsonFile<T = unknown>(name: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.resolve(`${localesFolder}/${name}`), 'utf8'))
}

function getFileName(file: string | { path: string }): string {
  return typeof file === 'string' ? file : file.path
}

async function mergeLocale(locale: LocaleObject): Promise<void> {
  const source = await mergeLocaleObject(locale, { copy: true })
  if (!source) {
    return
  }

  await fs.writeFile(
    path.resolve(`${destFolder}/${locale.code}.json`),
    `${JSON.stringify(source, null, 2)}\n`,
    'utf-8',
  )
}
