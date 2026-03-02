import { usePreferredLanguages } from '@vueuse/core'

/**
 * Composable to determine the best locale for formatting numbers and dates.
 * It respects the user's preference to use the system/browser locale or the app's selected locale.
 */
export const useUserLocale = () => {
  const { locale } = useI18n()
  const { settings } = useSettings()
  const languages = usePreferredLanguages()

  const userLocale = computed(() => {
    // If the user wants to use the system locale and we are on the client side with available languages
    if (settings.value.useSystemLocaleForFormatting && languages.value.length > 0) {
      return languages.value[0]
    }

    // Fallback to the app's selected locale (also used during SSR to avoid hydration mismatch if possible,
    // though formatting might change on client hydration if system locale differs)
    return locale.value
  })

  return {
    userLocale,
  }
}
