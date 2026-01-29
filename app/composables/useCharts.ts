import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'

export type PackumentLikeForTime = {
  time?: Record<string, string>
}

export type DailyDownloadPoint = { downloads: number; day: string }
export type WeeklyDownloadPoint = {
  downloads: number
  weekKey: string
  weekStart: string
  weekEnd: string
}
export type MonthlyDownloadPoint = { downloads: number; month: string }
export type YearlyDownloadPoint = { downloads: number; year: string }

type PackageDownloadEvolutionOptionsBase = {
  startDate?: string
  endDate?: string
}

export type PackageDownloadEvolutionOptionsDay = PackageDownloadEvolutionOptionsBase & {
  granularity: 'day'
}
export type PackageDownloadEvolutionOptionsWeek = PackageDownloadEvolutionOptionsBase & {
  granularity: 'week'
  weeks?: number
}
export type PackageDownloadEvolutionOptionsMonth = PackageDownloadEvolutionOptionsBase & {
  granularity: 'month'
  months?: number
}
export type PackageDownloadEvolutionOptionsYear = PackageDownloadEvolutionOptionsBase & {
  granularity: 'year'
}

export type PackageDownloadEvolutionOptions =
  | PackageDownloadEvolutionOptionsDay
  | PackageDownloadEvolutionOptionsWeek
  | PackageDownloadEvolutionOptionsMonth
  | PackageDownloadEvolutionOptionsYear

type DailyDownloadsResponse = { downloads: Array<{ day: string; downloads: number }> }

declare function fetchNpmDownloadsRange(
  packageName: string,
  startIso: string,
  endIso: string,
): Promise<DailyDownloadsResponse>

function toIsoDateString(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number): Date {
  const updatedDate = new Date(date)
  updatedDate.setUTCDate(updatedDate.getUTCDate() + days)
  return updatedDate
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function startOfUtcYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
}

function parseIsoDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

function formatIsoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function differenceInUtcDaysInclusive(startIso: string, endIso: string): number {
  const start = parseIsoDateOnly(startIso)
  const end = parseIsoDateOnly(endIso)
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1
}

function splitIsoRangeIntoChunksInclusive(
  startIso: string,
  endIso: string,
  maximumDaysPerRequest: number,
): Array<{ startIso: string; endIso: string }> {
  const totalDays = differenceInUtcDaysInclusive(startIso, endIso)
  if (totalDays <= maximumDaysPerRequest) return [{ startIso, endIso }]

  const chunks: Array<{ startIso: string; endIso: string }> = []
  let cursorStart = parseIsoDateOnly(startIso)
  const finalEnd = parseIsoDateOnly(endIso)

  while (cursorStart.getTime() <= finalEnd.getTime()) {
    const cursorEnd = addDays(cursorStart, maximumDaysPerRequest - 1)
    const actualEnd = cursorEnd.getTime() < finalEnd.getTime() ? cursorEnd : finalEnd

    chunks.push({
      startIso: formatIsoDateOnly(cursorStart),
      endIso: formatIsoDateOnly(actualEnd),
    })

    cursorStart = addDays(actualEnd, 1)
  }

  return chunks
}

function mergeDailyPoints(
  points: Array<{ day: string; downloads: number }>,
): Array<{ day: string; downloads: number }> {
  const downloadsByDay = new Map<string, number>()

  for (const point of points) {
    downloadsByDay.set(point.day, (downloadsByDay.get(point.day) ?? 0) + point.downloads)
  }

  return Array.from(downloadsByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, downloads]) => ({ day, downloads }))
}

function buildDailyEvolutionFromDaily(
  daily: Array<{ day: string; downloads: number }>,
): DailyDownloadPoint[] {
  return daily
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(item => ({ day: item.day, downloads: item.downloads }))
}

function buildRollingWeeklyEvolutionFromDaily(
  daily: Array<{ day: string; downloads: number }>,
  rangeStartIso: string,
  rangeEndIso: string,
): WeeklyDownloadPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const rangeStartDate = parseIsoDateOnly(rangeStartIso)
  const rangeEndDate = parseIsoDateOnly(rangeEndIso)

  const groupedByIndex = new Map<number, number>()

  for (const item of sorted) {
    const itemDate = parseIsoDateOnly(item.day)
    const dayOffset = Math.floor((itemDate.getTime() - rangeStartDate.getTime()) / 86400000)
    if (dayOffset < 0) continue

    const weekIndex = Math.floor(dayOffset / 7)
    groupedByIndex.set(weekIndex, (groupedByIndex.get(weekIndex) ?? 0) + item.downloads)
  }

  return Array.from(groupedByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, downloads]) => {
      const weekStartDate = addDays(rangeStartDate, weekIndex * 7)
      const weekEndDate = addDays(weekStartDate, 6)

      // Clamp weekEnd to the actual data range end date
      const clampedWeekEndDate =
        weekEndDate.getTime() > rangeEndDate.getTime() ? rangeEndDate : weekEndDate

      const weekStartIso = toIsoDateString(weekStartDate)
      const weekEndIso = toIsoDateString(clampedWeekEndDate)

      return {
        downloads,
        weekKey: `${weekStartIso}_${weekEndIso}`,
        weekStart: weekStartIso,
        weekEnd: weekEndIso,
      }
    })
}

function buildMonthlyEvolutionFromDaily(
  daily: Array<{ day: string; downloads: number }>,
): MonthlyDownloadPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const downloadsByMonth = new Map<string, number>()

  for (const item of sorted) {
    const month = item.day.slice(0, 7)
    downloadsByMonth.set(month, (downloadsByMonth.get(month) ?? 0) + item.downloads)
  }

  return Array.from(downloadsByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, downloads]) => ({ month, downloads }))
}

function buildYearlyEvolutionFromDaily(
  daily: Array<{ day: string; downloads: number }>,
): YearlyDownloadPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const downloadsByYear = new Map<string, number>()

  for (const item of sorted) {
    const year = item.day.slice(0, 4)
    downloadsByYear.set(year, (downloadsByYear.get(year) ?? 0) + item.downloads)
  }

  return Array.from(downloadsByYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, downloads]) => ({ year, downloads }))
}

function getClientDailyRangePromiseCache() {
  if (!import.meta.client) return null

  const globalScope = globalThis as unknown as {
    __npmDailyRangePromiseCache?: Map<string, Promise<Array<{ day: string; downloads: number }>>>
  }

  if (!globalScope.__npmDailyRangePromiseCache) {
    globalScope.__npmDailyRangePromiseCache = new Map()
  }

  return globalScope.__npmDailyRangePromiseCache
}

async function fetchDailyRangeCached(packageName: string, startIso: string, endIso: string) {
  const cache = getClientDailyRangePromiseCache()

  if (!cache) {
    const response = await fetchNpmDownloadsRange(packageName, startIso, endIso)
    return [...response.downloads].sort((a, b) => a.day.localeCompare(b.day))
  }

  const cacheKey = `${packageName}:${startIso}:${endIso}`
  const cachedPromise = cache.get(cacheKey)
  if (cachedPromise) return cachedPromise

  const promise = fetchNpmDownloadsRange(packageName, startIso, endIso)
    .then((response: DailyDownloadsResponse) =>
      [...response.downloads].sort((a, b) => a.day.localeCompare(b.day)),
    )
    .catch(error => {
      cache.delete(cacheKey)
      throw error
    })

  cache.set(cacheKey, promise)
  return promise
}

/**
 * API limit workaround:
 * If the requested range is larger than the API allows (≈18 months),
 * split into multiple requests, then merge/sum by day.
 */
async function fetchDailyRangeChunked(packageName: string, startIso: string, endIso: string) {
  const maximumDaysPerRequest = 540
  const ranges = splitIsoRangeIntoChunksInclusive(startIso, endIso, maximumDaysPerRequest)

  if (ranges.length === 1) {
    return fetchDailyRangeCached(packageName, startIso, endIso)
  }

  const all: Array<{ day: string; downloads: number }> = []

  for (const range of ranges) {
    const part = await fetchDailyRangeCached(packageName, range.startIso, range.endIso)
    all.push(...part)
  }

  return mergeDailyPoints(all)
}

function toDateOnly(value?: string): string | null {
  if (!value) return null
  const dateOnly = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null
}

function getNpmPackageCreationDate(packument: PackumentLikeForTime): string | null {
  const time = packument.time
  if (!time) return null
  if (time.created) return time.created

  const versionDates = Object.entries(time)
    .filter(([key, value]) => key !== 'modified' && key !== 'created' && Boolean(value))
    .map(([, value]) => value)
    .sort((a, b) => a.localeCompare(b))

  return versionDates[0] ?? null
}

export function useCharts() {
  function resolveDateRange(
    downloadEvolutionOptions: PackageDownloadEvolutionOptions,
    packageCreatedIso: string | null,
  ): { start: Date; end: Date } {
    const today = new Date()
    const yesterday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
    )

    const endDateOnly = toDateOnly(downloadEvolutionOptions.endDate)
    const end = endDateOnly ? new Date(`${endDateOnly}T00:00:00.000Z`) : yesterday

    const startDateOnly = toDateOnly(downloadEvolutionOptions.startDate)
    if (startDateOnly) {
      const start = new Date(`${startDateOnly}T00:00:00.000Z`)
      return { start, end }
    }

    let start: Date

    if (downloadEvolutionOptions.granularity === 'year') {
      if (packageCreatedIso) {
        start = startOfUtcYear(new Date(packageCreatedIso))
      } else {
        start = addDays(end, -(5 * 365) + 1)
      }
    } else if (downloadEvolutionOptions.granularity === 'month') {
      const monthCount = downloadEvolutionOptions.months ?? 12
      const firstOfThisMonth = startOfUtcMonth(end)
      start = new Date(
        Date.UTC(
          firstOfThisMonth.getUTCFullYear(),
          firstOfThisMonth.getUTCMonth() - (monthCount - 1),
          1,
        ),
      )
    } else if (downloadEvolutionOptions.granularity === 'week') {
      const weekCount = downloadEvolutionOptions.weeks ?? 52

      // Full rolling weeks ending on `end` (yesterday by default)
      // Range length is exactly weekCount * 7 days (inclusive)
      start = addDays(end, -(weekCount * 7) + 1)
    } else {
      start = addDays(end, -30 + 1)
    }

    return { start, end }
  }

  async function fetchPackageDownloadEvolution(
    packageName: MaybeRefOrGetter<string>,
    createdIso: MaybeRefOrGetter<string | null | undefined>,
    downloadEvolutionOptions: MaybeRefOrGetter<PackageDownloadEvolutionOptions>,
  ): Promise<
    DailyDownloadPoint[] | WeeklyDownloadPoint[] | MonthlyDownloadPoint[] | YearlyDownloadPoint[]
  > {
    const resolvedPackageName = toValue(packageName)
    const resolvedCreatedIso = toValue(createdIso) ?? null
    const resolvedOptions = toValue(downloadEvolutionOptions)

    const { start, end } = resolveDateRange(resolvedOptions, resolvedCreatedIso)

    const startIso = toIsoDateString(start)
    const endIso = toIsoDateString(end)

    const sortedDaily = await fetchDailyRangeChunked(resolvedPackageName, startIso, endIso)

    if (resolvedOptions.granularity === 'day') return buildDailyEvolutionFromDaily(sortedDaily)
    if (resolvedOptions.granularity === 'week')
      return buildRollingWeeklyEvolutionFromDaily(sortedDaily, startIso, endIso)
    if (resolvedOptions.granularity === 'month') return buildMonthlyEvolutionFromDaily(sortedDaily)
    return buildYearlyEvolutionFromDaily(sortedDaily)
  }

  return {
    fetchPackageDownloadEvolution,
    getNpmPackageCreationDate,
  }
}
