import { useI18n as useOriginalI18n } from 'vue-i18n'

export function useI18n() {
  const i18n = useOriginalI18n()

  const { t, d, n, ...rest } = i18n

  return {
    ...rest,
    t: wrapI18n(t),
    d: wrapI18n(d),
    n: wrapI18n(n),
  } satisfies ReturnType<typeof useOriginalI18n>
}

export function wrapI18n<T extends (...args: any[]) => any>(t: T): T {
  return <T>((...args: any[]) => {
    return import.meta.server ? t(...args) : isHydrated.value ? t(...args) : ''
  })
}
