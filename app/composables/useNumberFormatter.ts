export function useNumberFormatter(options?: Intl.NumberFormatOptions) {
  const { locale } = useI18n()

  return computed(() => new Intl.NumberFormat(locale.value, options))
}

export const useCompactNumberFormatter = () =>
  useNumberFormatter({
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  })

export const useBytesFormatter = () => {
  const { t } = useI18n()
  const decimalNumberFormatter = useNumberFormatter({
    maximumFractionDigits: 1,
  })

  return {
    format: (bytes: number) => {
      if (bytes < 1024)
        return t('package.size.b', {
          size: decimalNumberFormatter.value.format(bytes),
        })
      if (bytes < 1024 * 1024)
        return t('package.size.kb', {
          size: decimalNumberFormatter.value.format(bytes / 1024),
        })
      return t('package.size.mb', {
        size: decimalNumberFormatter.value.format(bytes / (1024 * 1024)),
      })
    },
  }
}
