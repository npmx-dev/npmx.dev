import type {
  DailyDataPoint,
  DailyRawPoint,
  MonthlyDataPoint,
  WeeklyDataPoint,
  YearlyDataPoint,
} from '~/types/chart'
import { DAY_MS, parseIsoDate, toIsoDate, addDays, daysInMonth, daysInYear } from '~/utils/date'

// ---------------------------------------------------------------------------
// Fill partial bucket
// ---------------------------------------------------------------------------

/** Proportionally scale a partial bucket to estimate the full-period value. */
export function fillPartialBucket(value: number, actualDays: number, totalDays: number): number {
  if (actualDays <= 0 || actualDays >= totalDays) return value
  return Math.round((value * totalDays) / actualDays)
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function buildDailyEvolution(daily: DailyRawPoint[]): DailyDataPoint[] {
  return daily
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(item => ({
      day: item.day,
      value: item.value,
      timestamp: parseIsoDate(item.day).getTime(),
    }))
}

export function buildWeeklyEvolution(
  daily: DailyRawPoint[],
  rangeStartIso: string,
  rangeEndIso: string,
): WeeklyDataPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  if (sorted.length === 0) return []

  const rangeStartDate = parseIsoDate(rangeStartIso)

  // Align from last day with actual data (npm has 1-2 day delay, today is incomplete)
  const lastNonZero = sorted.findLast(d => d.value > 0)
  const pickerEnd = parseIsoDate(rangeEndIso)
  const effectiveEnd = lastNonZero ? parseIsoDate(lastNonZero.day) : pickerEnd
  const rangeEndDate = effectiveEnd.getTime() < pickerEnd.getTime() ? effectiveEnd : pickerEnd

  // Group into 7-day buckets from END backwards
  const buckets = new Map<number, number>()
  for (const item of sorted) {
    const offset = Math.floor((rangeEndDate.getTime() - parseIsoDate(item.day).getTime()) / DAY_MS)
    if (offset < 0) continue
    const idx = Math.floor(offset / 7)
    buckets.set(idx, (buckets.get(idx) ?? 0) + item.value)
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => b - a)
    .map(([idx, value]) => {
      const weekEndDate = addDays(rangeEndDate, -(idx * 7))
      let weekStartDate = addDays(weekEndDate, -6)

      // First bucket may be partial
      if (weekStartDate.getTime() < rangeStartDate.getTime()) {
        weekStartDate = rangeStartDate
        const actualDays =
          Math.floor((weekEndDate.getTime() - rangeStartDate.getTime()) / DAY_MS) + 1
        value = fillPartialBucket(value, actualDays, 7)
      }

      const weekStartIso = toIsoDate(weekStartDate)
      const weekEndIso = toIsoDate(weekEndDate)
      return {
        value,
        weekKey: `${weekStartIso}_${weekEndIso}`,
        weekStart: weekStartIso,
        weekEnd: weekEndIso,
        timestampStart: weekStartDate.getTime(),
        timestampEnd: weekEndDate.getTime(),
      }
    })
}

export function buildMonthlyEvolution(
  daily: DailyRawPoint[],
  rangeStartIso?: string,
  rangeEndIso?: string,
): MonthlyDataPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const byMonth = new Map<string, number>()
  for (const item of sorted) {
    const m = item.day.slice(0, 7)
    byMonth.set(m, (byMonth.get(m) ?? 0) + item.value)
  }

  const entries = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b))

  return entries.map(([month, value], i) => {
    const [y, m] = month.split('-').map(Number) as [number, number]
    const total = daysInMonth(y, m - 1)
    const isFirst = i === 0
    const isLast = i === entries.length - 1

    const startDay = isFirst && rangeStartIso ? Number(rangeStartIso.split('-')[2]) : 1
    const endDay = isLast && rangeEndIso ? Number(rangeEndIso.split('-')[2]) : total
    const actualDays = endDay - startDay + 1

    if (actualDays < total) value = fillPartialBucket(value, actualDays, total)

    return { month, value, timestamp: parseIsoDate(`${month}-01`).getTime() }
  })
}

export function buildYearlyEvolution(
  daily: DailyRawPoint[],
  rangeStartIso?: string,
  rangeEndIso?: string,
): YearlyDataPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const byYear = new Map<string, number>()
  for (const item of sorted) {
    const y = item.day.slice(0, 4)
    byYear.set(y, (byYear.get(y) ?? 0) + item.value)
  }

  const entries = Array.from(byYear.entries()).sort(([a], [b]) => a.localeCompare(b))

  return entries.map(([year, value], i) => {
    const total = daysInYear(Number(year))
    const yearStart = parseIsoDate(`${year}-01-01`)
    const isFirst = i === 0
    const isLast = i === entries.length - 1

    const startOffset =
      isFirst && rangeStartIso
        ? Math.floor((parseIsoDate(rangeStartIso).getTime() - yearStart.getTime()) / DAY_MS)
        : 0
    const endOffset =
      isLast && rangeEndIso
        ? Math.floor((parseIsoDate(rangeEndIso).getTime() - yearStart.getTime()) / DAY_MS) + 1
        : total
    const actualDays = endOffset - startOffset

    if (actualDays < total) value = fillPartialBucket(value, actualDays, total)

    return { year, value, timestamp: yearStart.getTime() }
  })
}
