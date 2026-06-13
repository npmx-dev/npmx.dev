// TODO: when temporal?
export const DAY_MS = 86_400_000

export function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

export function daysInYear(year: number): number {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 366 : 365
}

export function getEffectiveEndDateIso(endDate?: string): string {
  if (endDate) {
    return endDate
  }

  const today = new Date()

  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))
    .toISOString()
    .slice(0, 10)
}

export function isLastDayOfMonth(dateIso: string): boolean {
  const date = new Date(`${dateIso}T00:00:00.000Z`)

  const lastDayOfMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate()

  return date.getUTCDate() === lastDayOfMonth
}

export function isLastDayOfYear(dateIso: string): boolean {
  const date = new Date(`${dateIso}T00:00:00.000Z`)
  return date.getUTCMonth() === 11 && date.getUTCDate() === 31
}
