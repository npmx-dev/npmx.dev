// https://atproto.com supports 4 locales as of 2026-02-07
/** atproto.com in the user's language, where the site has a translation. */
export function useAtprotoSiteUrl() {
  const { locale } = useI18n()
  return computed(() => {
    const lang = locale.value.split('-')[0] ?? 'en'
    return `https://atproto.com/${['ko', 'pt', 'ja'].includes(lang) ? lang : ''}`
  })
}
