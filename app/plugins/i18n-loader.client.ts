export default defineNuxtPlugin({
  name: 'i18n-loader',
  dependsOn: ['preferences-sync'],
  enforce: 'post',
  env: { islands: false },
  setup() {
    const { $i18n } = useNuxtApp()
    const { locale, locales, setLocale } = $i18n
    const { preferences } = useUserPreferences()
    const settingsLocale = preferences.value.selectedLocale

    const matchedLocale = locales.value.map(l => l.code).find(code => code === settingsLocale)

    if (matchedLocale && matchedLocale !== locale.value) {
      setLocale(matchedLocale)
    }
  },
})
