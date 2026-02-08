import type { I18nStatus, I18nLocaleStatus } from '#shared/types'

/**
 * Composable for accessing translation status data from Lunaria.
 * Provides information about translation progress for each locale.
 */
export function useI18nStatus() {
  const { locale } = useI18n()

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

  /**
   * Get the translation status for a specific locale
   */
  function getLocaleStatus(langCode: string): I18nLocaleStatus | null {
    if (!status.value) return null
    return status.value.locales.find(l => l.lang === langCode) ?? null
  }

  /**
   * Translation status for the current locale
   */
  const currentLocaleStatus = computed<I18nLocaleStatus | null>(() => {
    return getLocaleStatus(locale.value)
  })

  /**
   * Whether the current locale's translation is 100% complete
   */
  const isComplete = computed(() => {
    const localeStatus = currentLocaleStatus.value
    if (!localeStatus) return true // Assume complete if no data
    return localeStatus.percentComplete === 100
  })

  /**
   * Whether the current locale is the source locale (English)
   */
  const isSourceLocale = computed(() => {
    return locale.value === (status.value?.sourceLocale.lang ?? 'en-US')
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
  }
}
