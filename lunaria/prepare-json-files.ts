import type { Locale } from '@lunariajs/core'
import type { LocaleObject } from '@nuxtjs/i18n'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { currentLocales, lunariaJSONFiles } from '../config/i18n.ts'
import { deepCopy } from '@intlify/shared'

const destFolder = path.resolve('lunaria/files')
const localesFolder = path.resolve('i18n/locales')

const defaultLocale = currentLocales.find(l => l.code === 'en-US')!
export { lunariaJSONFiles }
export const sourceLocale = {
  label: defaultLocale.name,
  lang: defaultLocale.code,
}
export const locales: Locale[] = currentLocales
  .filter(l => l.code !== 'en-US')
  .map(l => ({
    label: l.name,
    lang: l.code,
  }))

export async function prepareJsonFiles() {
  await fs.rm(destFolder, { recursive: true, force: true })
  await fs.mkdir(destFolder)
  await Promise.all(currentLocales.map(l => mergeLocale(l)))
}

async function loadJsonFile(name: string) {
  return JSON.parse(await fs.readFile(path.resolve(`${localesFolder}/${name}`), 'utf8'))
}

async function mergeLocale(locale: LocaleObject) {
  if (locale.file || locale.files.length === 1) {
    const json = locale.file || locale.files[0]
    await fs.cp(path.resolve(`${localesFolder}/${json}`), path.resolve(`${destFolder}/${json}`))
    return
  }

  const source = await loadJsonFile(locale.files[0] as string)
  let currentSource: unknown
  for (let i = 1; i < locale.files.length; i++) {
    currentSource = await loadJsonFile(locale.files[i] as string)
    deepCopy(currentSource, source)
  }

  await fs.writeFile(
    path.resolve(`${destFolder}/${locale.code}.json`),
    JSON.stringify(source, null, 2),
  )
}
