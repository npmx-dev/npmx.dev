import { createResolver, defineNuxtModule } from 'nuxt/kit'
import { currentLocales } from '../config/i18n.ts'
import type { LocaleObject } from '@nuxtjs/i18n'
import fs from 'node:fs'

export default defineNuxtModule({
  meta: {
    name: 'npmx-i18n',
  },
  setup(_, nuxt) {
    nuxt.hook('i18n:registerModule', registerModule => {
      console.log(currentLocales)
      const newLocales = addFeatures()
      console.log(newLocales)
      registerModule({
        langDir: 'i18n/locales',
        locales: newLocales,
      })
    })
  },
})

const features = ['a11y', 'about', 'compare', 'pds', 'private_policy', 'vacations']

const { resolve } = createResolver(import.meta.url)

function addFeatures(): LocaleObject[] {
  const i18nDir = resolve('../i18n/locales')
  console.log(i18nDir)

  const result: LocaleObject[] = []

  for (const locale of currentLocales) {
    const baseFiles = locale.files ? [...locale.files] : locale.file ? [locale.file as string] : []
    const newFiles: string[] = []
    let hasNewFeatures = false

    for (const f of baseFiles) {
      const fileName = f as string
      newFiles.push(fileName)

      for (const feature of features) {
        const featurePath = resolve(i18nDir, feature, fileName)
        if (fs.existsSync(featurePath)) {
          newFiles.push(`${feature}/${fileName}`)
          hasNewFeatures = true
        }
      }
    }

    if (hasNewFeatures) {
      const copy = { ...locale, files: newFiles }
      delete copy.file
      result.push(copy)
    } else {
      result.push(locale)
    }
  }

  return result
}
