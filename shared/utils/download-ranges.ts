import type { DailyRawPoint } from '~/types/chart'
import { addDays, parseIsoDate, toIsoDate } from '~/utils/date'

export function differenceInUtcDaysInclusive(startIso: string, endIso: string): number {
  const start = parseIsoDate(startIso)
  const end = parseIsoDate(endIso)

  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

export function splitIsoRangeIntoChunksInclusive(
  startIso: string,
  endIso: string,
  maximumDaysPerRequest: number,
): Array<{ startIso: string; endIso: string }> {
  const totalDays = differenceInUtcDaysInclusive(startIso, endIso)

  if (totalDays <= maximumDaysPerRequest) {
    return [{ startIso, endIso }]
  }

  const chunks: Array<{ startIso: string; endIso: string }> = []

  let cursorStart = parseIsoDate(startIso)
  const finalEnd = parseIsoDate(endIso)

  while (cursorStart.getTime() <= finalEnd.getTime()) {
    const cursorEnd = addDays(cursorStart, maximumDaysPerRequest - 1)
    const actualEnd = cursorEnd.getTime() < finalEnd.getTime() ? cursorEnd : finalEnd

    chunks.push({
      startIso: toIsoDate(cursorStart),
      endIso: toIsoDate(actualEnd),
    })

    cursorStart = addDays(actualEnd, 1)
  }

  return chunks
}

export function mergeDailyPoints(points: DailyRawPoint[]): DailyRawPoint[] {
  const valuesByDay = new Map<string, number>()

  for (const point of points) {
    valuesByDay.set(point.day, (valuesByDay.get(point.day) ?? 0) + point.value)
  }

  return Array.from(valuesByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, value }))
}
