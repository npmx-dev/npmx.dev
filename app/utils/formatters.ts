export function formatNumber(num: number, _locale?: string): string {
  // TODO: Support different locales (needs care to ensure hydration works correctly)
  return new Intl.NumberFormat('en-US').format(num)
}

export function toIsoDateString(date: Date): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatCompactNumber(
  value: number,
  options?: { decimals?: number; space?: boolean },
): string {
  const decimals = options?.decimals ?? 0
  const space = options?.space ?? false

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  const fmt = (n: number) => {
    if (decimals <= 0) return Math.round(n).toString()
    return n
      .toFixed(decimals)
      .replace(/\.0+$/, '')
      .replace(/(\.\d*?)0+$/, '$1')
  }

  const join = (suffix: string, n: number) => `${sign}${fmt(n)}${space ? ' ' : ''}${suffix}`

  if (abs >= 1e12) return join('T', abs / 1e12)
  if (abs >= 1e9) return join('B', abs / 1e9)
  if (abs >= 1e6) return join('M', abs / 1e6)
  if (abs >= 1e3) return join('k', abs / 1e3)

  return `${sign}${Math.round(abs)}`
}
