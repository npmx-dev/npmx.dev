import { currentLocales, datetimeFormats, numberFormats, pluralRules } from '../config/i18n'

export default defineI18nConfig(() => {
  return {
    availableLocales: currentLocales.map(l => l.code),
    fallbackLocale: 'en-US',
    fallbackWarn: true,
    missingWarn: true,
    datetimeFormats,
    numberFormats,
    pluralRules,
  }
})
