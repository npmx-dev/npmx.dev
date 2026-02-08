export default defineNuxtPlugin({
  enforce: 'post',
  env: { islands: false },
  setup() {
    const { $i18n } = useNuxtApp()
    const { locale, locales, setLocale } = $i18n
    const { settings } = useSettings()
    const settingsLocale = settings.value.selectedLocale

    if (
      settingsLocale &&
      //   Check if the value is a supported locale
      locales.value.map(l => l.code).includes(settingsLocale) &&
      //   Check if the value is not a current locale
      settingsLocale !== locale.value
    ) {
      setLocale(settingsLocale)
    }
  },
})
