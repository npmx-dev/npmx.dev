export function formatDownloads(downloads: number | undefined): string {
  if (downloads === undefined) {
    return 'downloads n/a'
  }

  if (downloads >= 1_000_000) {
    return `${(downloads / 1_000_000).toFixed(1)}m/w`
  }

  if (downloads >= 1_000) {
    return `${Math.round(downloads / 1_000)}k/w`
  }

  return `${downloads}/w`
}

export function formatBytes(bytes: number | undefined): string | undefined {
  if (bytes === undefined) {
    return undefined
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MiB`
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KiB`
  }

  return `${bytes} B`
}

export function formatDate(value: string | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return date.toISOString().slice(0, 10)
}

export function truncateText(text: string, maxLength: number): string {
  if (maxLength <= 0) {
    return ''
  }

  if (text.length <= maxLength) {
    return text
  }

  if (maxLength <= 3) {
    return '.'.repeat(maxLength)
  }

  return `${text.slice(0, Math.max(0, maxLength - 3))}...`
}

export function compactList(items: string[] | undefined, limit: number): string {
  if (!items) {
    return ''
  }

  const visible = items.slice(0, limit)
  const remaining = items.length - visible.length

  if (remaining <= 0) {
    return visible.join(', ')
  }

  return `${visible.join(', ')} +${remaining} more`
}

export function isDefinedString(value: string | undefined): value is string {
  return value !== undefined
}

export function createInlineMeta(items: Array<string | undefined>): string {
  return items.filter(isDefinedString).join('   ')
}

export function createField(label: string, value: string | number | undefined): string | undefined {
  if (value === undefined || value === '') {
    return undefined
  }

  return `${label.padEnd(13, ' ')} ${value}`
}

export function formatRecord(
  record: Record<string, string> | undefined,
  limit: number,
): string | undefined {
  if (!record) {
    return undefined
  }

  const entries = Object.entries(record).map(([key, value]) => `${key}:${value}`)
  return entries.length > 0 ? compactList(entries, limit) : undefined
}
