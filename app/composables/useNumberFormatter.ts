export function useNumberFormatter(options?: Intl.NumberFormatOptions) {
  const { userLocale } = useUserLocale()

  return computed(
    () =>
      new Intl.NumberFormat(
        userLocale.value,
        options ?? {
          maximumFractionDigits: 0,
        },
      ),
  )
}

export const useCompactNumberFormatter = () =>
  useNumberFormatter({
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  })

export const useBytesFormatter = () => {
  const { userLocale } = useUserLocale()

  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte', 'terabyte', 'petabyte']

  // Create formatters reactively based on the user's preferred locale.
  // This ensures that when the locale (or the setting) changes, all formatters are recreated.
  const formatters = computed(() => {
    const locale = userLocale.value
    const map = new Map<string, Intl.NumberFormat>()

    units.forEach(unit => {
      map.set(
        unit,
        new Intl.NumberFormat(locale, {
          style: 'unit',
          unit,
          unitDisplay: 'short',
          maximumFractionDigits: 2,
        }),
      )
    })

    return map
  })

  return {
    format: (bytes: number) => {
      let value = bytes
      let unitIndex = 0

      // Use 1_000 as base (SI units) instead of 1_024.
      while (value >= 1_000 && unitIndex < units.length - 1) {
        value /= 1_000
        unitIndex++
      }

      const unit = units[unitIndex]!
      // Accessing formatters.value here establishes the reactive dependency
      return formatters.value.get(unit)!.format(value)
    },
  }
}
