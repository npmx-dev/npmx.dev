/**
 * Composable for accessing translation status data from Lunaria.
 * Provides information about translation progress for each locale.
 */
export function useI18nStatus() {
  const { locale: currentLocale } = useI18n()

  const {
    data: status,
    status: fetchStatus,
    error,
  } = useFetch<I18nStatus>('/lunaria/status.json', {
    responseType: 'json',
    server: false,
    // Cache the result to avoid refetching on navigation
    getCachedData: (key, nuxtApp) => nuxtApp.payload.data[key] ?? nuxtApp.static.data[key],
  })

  const localesMap = computed<Map<string, I18nLocaleStatus> | undefined>(() => {
    return status.value?.locales.reduce((acc, locale) => {
      acc.set(locale.lang, locale)
      return acc
    }, new Map())
  })

  /**
   * Get the translation status for a specific locale
   */
  function getLocaleStatus(langCode: string): I18nLocaleStatus | null {
    return localesMap.value?.get(langCode) ?? null
  }

  /**
   * Translation status for the current locale
   */
  const currentLocaleStatus = computed<I18nLocaleStatus | null>(() =>
    getLocaleStatus(currentLocale.value),
  )

  /**
   * Whether the current locale's translation is 100% complete
   */
  const isComplete = computed(() => {
    const localeStatus = currentLocaleStatus.value
    if (!localeStatus) return true // Assume complete if no data
    return localeStatus.percentComplete === 100
  })

  /**
   * Whether the current locale is the source locale (English) or a variant of it.
   * The source locale is 'en' (base), but app-facing locale codes are 'en-US', 'en-GB', etc.
   * We check if the current locale starts with the source locale code to handle variants.
   */
  const isSourceLocale = computed(() => {
    const sourceLang = status.value?.sourceLocale.lang ?? 'en'
    return currentLocale.value === sourceLang || currentLocale.value.startsWith(`${sourceLang}-`)
  })

  /**
   * GitHub URL to edit the current locale's translation file
   */
  const githubEditUrl = computed(() => {
    return currentLocaleStatus.value?.githubEditUrl ?? null
  })

  return {
    /** Full translation status data */
    status,
    /** Fetch status ('idle' | 'pending' | 'success' | 'error') */
    fetchStatus,
    /** Fetch error if any */
    error,
    /** Get status for a specific locale */
    getLocaleStatus,
    /** Status for the current locale */
    currentLocaleStatus,
    /** Whether current locale is 100% complete */
    isComplete,
    /** Whether current locale is the source (English) */
    isSourceLocale,
    /** GitHub edit URL for current locale */
    githubEditUrl,
    /** locale info map by lang */
    localesMap,
  }
}
