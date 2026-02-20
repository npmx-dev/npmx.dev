import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type {
  DailyDataPoint,
  DailyRawPoint,
  EvolutionOptions,
  MonthlyDataPoint,
  WeeklyDataPoint,
  YearlyDataPoint,
} from '~/types/chart'
import type { RepoRef } from '#shared/utils/git-providers'
import { parseRepoUrl } from '#shared/utils/git-providers'
import type { PackageMetaResponse } from '#shared/types'
import { encodePackageName } from '#shared/utils/npm'
import { fetchNpmDownloadsRange } from '~/utils/npm/api'

export type PackumentLikeForTime = {
  time?: Record<string, string>
}

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

function mergeDailyPoints(points: DailyRawPoint[]): DailyRawPoint[] {
  const valuesByDay = new Map<string, number>()

  for (const point of points) {
    valuesByDay.set(point.day, (valuesByDay.get(point.day) ?? 0) + point.value)
  }

  return Array.from(valuesByDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, value }))
}

export function buildDailyEvolutionFromDaily(daily: DailyRawPoint[]): DailyDataPoint[] {
  return daily
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(item => {
      const dayDate = parseIsoDateOnly(item.day)
      const timestamp = dayDate.getTime()

      return { day: item.day, value: item.value, timestamp }
    })
}

export function buildRollingWeeklyEvolutionFromDaily(
  daily: DailyRawPoint[],
  rangeStartIso: string,
  rangeEndIso: string,
): WeeklyDataPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const rangeStartDate = parseIsoDateOnly(rangeStartIso)
  const rangeEndDate = parseIsoDateOnly(rangeEndIso)

  const groupedByIndex = new Map<number, number>()

  for (const item of sorted) {
    const itemDate = parseIsoDateOnly(item.day)
    const dayOffset = Math.floor((itemDate.getTime() - rangeStartDate.getTime()) / 86400000)
    if (dayOffset < 0) continue

    const weekIndex = Math.floor(dayOffset / 7)
    groupedByIndex.set(weekIndex, (groupedByIndex.get(weekIndex) ?? 0) + item.value)
  }

  return Array.from(groupedByIndex.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekIndex, value]) => {
      const weekStartDate = addDays(rangeStartDate, weekIndex * 7)
      const weekEndDate = addDays(weekStartDate, 6)

      // Clamp weekEnd to the actual data range end date
      const clampedWeekEndDate =
        weekEndDate.getTime() > rangeEndDate.getTime() ? rangeEndDate : weekEndDate

      const weekStartIso = toIsoDateString(weekStartDate)
      const weekEndIso = toIsoDateString(clampedWeekEndDate)

      const timestampStart = weekStartDate.getTime()
      const timestampEnd = clampedWeekEndDate.getTime()

      return {
        value,
        weekKey: `${weekStartIso}_${weekEndIso}`,
        weekStart: weekStartIso,
        weekEnd: weekEndIso,
        timestampStart,
        timestampEnd,
      }
    })
}

export function buildMonthlyEvolutionFromDaily(daily: DailyRawPoint[]): MonthlyDataPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const valuesByMonth = new Map<string, number>()

  for (const item of sorted) {
    const month = item.day.slice(0, 7)
    valuesByMonth.set(month, (valuesByMonth.get(month) ?? 0) + item.value)
  }

  return Array.from(valuesByMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const monthStartDate = parseIsoDateOnly(`${month}-01`)
      const timestamp = monthStartDate.getTime()
      return { month, value, timestamp }
    })
}

export function buildYearlyEvolutionFromDaily(daily: DailyRawPoint[]): YearlyDataPoint[] {
  const sorted = daily.slice().sort((a, b) => a.day.localeCompare(b.day))
  const valuesByYear = new Map<string, number>()

  for (const item of sorted) {
    const year = item.day.slice(0, 4)
    valuesByYear.set(year, (valuesByYear.get(year) ?? 0) + item.value)
  }

  return Array.from(valuesByYear.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => {
      const yearStartDate = parseIsoDateOnly(`${year}-01-01`)
      const timestamp = yearStartDate.getTime()
      return { year, value, timestamp }
    })
}

const npmDailyRangeCache = import.meta.client ? new Map<string, Promise<DailyRawPoint[]>>() : null
const likesEvolutionCache = import.meta.client ? new Map<string, Promise<DailyRawPoint[]>>() : null
const contributorsEvolutionCache = import.meta.client
  ? new Map<string, Promise<GitHubContributorStats[]>>()
  : null
const repoMetaCache = import.meta.client ? new Map<string, Promise<RepoRef | null>>() : null

/** Clears client-side promise caches. Exported for use in tests. */
export function clearClientCaches() {
  npmDailyRangeCache?.clear()
  likesEvolutionCache?.clear()
  contributorsEvolutionCache?.clear()
  repoMetaCache?.clear()
}

type GitHubContributorWeek = {
  w: number
  a: number
  d: number
  c: number
}

type GitHubContributorStats = {
  total: number
  weeks: GitHubContributorWeek[]
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0')
}

function toIsoMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`
}

function isOverlappingRange(start: Date, end: Date, rangeStart: Date, rangeEnd: Date): boolean {
  return end.getTime() >= rangeStart.getTime() && start.getTime() <= rangeEnd.getTime()
}

function buildWeeklyEvolutionFromContributorCounts(
  weeklyCounts: Map<number, number>,
  rangeStart: Date,
  rangeEnd: Date,
): WeeklyDataPoint[] {
  return Array.from(weeklyCounts.entries())
    .sort(([a], [b]) => a - b)
    .map(([weekStartSeconds, value]) => {
      const weekStartDate = new Date(weekStartSeconds * 1000)
      const weekEndDate = addDays(weekStartDate, 6)

      if (!isOverlappingRange(weekStartDate, weekEndDate, rangeStart, rangeEnd)) return null

      const clampedWeekEndDate = weekEndDate.getTime() > rangeEnd.getTime() ? rangeEnd : weekEndDate

      const weekStartIso = toIsoDateString(weekStartDate)
      const weekEndIso = toIsoDateString(clampedWeekEndDate)

      return {
        value,
        weekKey: `${weekStartIso}_${weekEndIso}`,
        weekStart: weekStartIso,
        weekEnd: weekEndIso,
        timestampStart: weekStartDate.getTime(),
        timestampEnd: clampedWeekEndDate.getTime(),
      }
    })
    .filter((item): item is WeeklyDataPoint => Boolean(item))
}

function buildMonthlyEvolutionFromContributorCounts(
  monthlyCounts: Map<string, number>,
  rangeStart: Date,
  rangeEnd: Date,
): MonthlyDataPoint[] {
  return Array.from(monthlyCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => {
      const [year, monthNumber] = month.split('-').map(Number)
      if (!year || !monthNumber) return null

      const monthStartDate = new Date(Date.UTC(year, monthNumber - 1, 1))
      const monthEndDate = new Date(Date.UTC(year, monthNumber, 0))

      if (!isOverlappingRange(monthStartDate, monthEndDate, rangeStart, rangeEnd)) return null

      return {
        month,
        value,
        timestamp: monthStartDate.getTime(),
      }
    })
    .filter((item): item is MonthlyDataPoint => Boolean(item))
}

function buildYearlyEvolutionFromContributorCounts(
  yearlyCounts: Map<string, number>,
  rangeStart: Date,
  rangeEnd: Date,
): YearlyDataPoint[] {
  return Array.from(yearlyCounts.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, value]) => {
      const yearNumber = Number(year)
      if (!yearNumber) return null

      const yearStartDate = new Date(Date.UTC(yearNumber, 0, 1))
      const yearEndDate = new Date(Date.UTC(yearNumber, 11, 31))

      if (!isOverlappingRange(yearStartDate, yearEndDate, rangeStart, rangeEnd)) return null

      return {
        year,
        value,
        timestamp: yearStartDate.getTime(),
      }
    })
    .filter((item): item is YearlyDataPoint => Boolean(item))
}

function buildContributorCounts(stats: GitHubContributorStats[]) {
  const weeklyCounts = new Map<number, number>()
  const monthlyCounts = new Map<string, number>()
  const yearlyCounts = new Map<string, number>()

  for (const contributor of stats ?? []) {
    const monthSet = new Set<string>()
    const yearSet = new Set<string>()

    for (const week of contributor?.weeks ?? []) {
      if (!week || week.c <= 0) continue

      weeklyCounts.set(week.w, (weeklyCounts.get(week.w) ?? 0) + 1)

      const weekStartDate = new Date(week.w * 1000)
      monthSet.add(toIsoMonthKey(weekStartDate))
      yearSet.add(String(weekStartDate.getUTCFullYear()))
    }

    for (const key of monthSet) {
      monthlyCounts.set(key, (monthlyCounts.get(key) ?? 0) + 1)
    }
    for (const key of yearSet) {
      yearlyCounts.set(key, (yearlyCounts.get(key) ?? 0) + 1)
    }
  }

  return { weeklyCounts, monthlyCounts, yearlyCounts }
}

async function fetchDailyRangeCached(packageName: string, startIso: string, endIso: string) {
  const cache = npmDailyRangeCache

  if (!cache) {
    const response = await fetchNpmDownloadsRange(packageName, startIso, endIso)
    return [...response.downloads]
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(d => ({ day: d.day, value: d.downloads }))
  }

  const cacheKey = `${packageName}:${startIso}:${endIso}`
  const cachedPromise = cache.get(cacheKey)
  if (cachedPromise) return cachedPromise

  const promise = fetchNpmDownloadsRange(packageName, startIso, endIso)
    .then(response =>
      [...response.downloads]
        .sort((a, b) => a.day.localeCompare(b.day))
        .map(d => ({ day: d.day, value: d.downloads })),
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

  const all: DailyRawPoint[] = []

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

export function getNpmPackageCreationDate(packument: PackumentLikeForTime): string | null {
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
    evolutionOptions: EvolutionOptions,
    packageCreatedIso: string | null,
  ): { start: Date; end: Date } {
    const today = new Date()
    const yesterday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
    )

    const endDateOnly = toDateOnly(evolutionOptions.endDate)
    const end = endDateOnly ? parseIsoDateOnly(endDateOnly) : yesterday

    const startDateOnly = toDateOnly(evolutionOptions.startDate)
    if (startDateOnly) {
      const start = parseIsoDateOnly(startDateOnly)
      return { start, end }
    }

    let start: Date

    if (evolutionOptions.granularity === 'year') {
      if (packageCreatedIso) {
        start = startOfUtcYear(new Date(packageCreatedIso))
      } else {
        start = addDays(end, -(5 * 365) + 1)
      }
    } else if (evolutionOptions.granularity === 'month') {
      const monthCount = evolutionOptions.months ?? 12
      const firstOfThisMonth = startOfUtcMonth(end)
      start = new Date(
        Date.UTC(
          firstOfThisMonth.getUTCFullYear(),
          firstOfThisMonth.getUTCMonth() - (monthCount - 1),
          1,
        ),
      )
    } else if (evolutionOptions.granularity === 'week') {
      const weekCount = evolutionOptions.weeks ?? 52

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
    evolutionOptions: MaybeRefOrGetter<EvolutionOptions>,
  ): Promise<DailyDataPoint[] | WeeklyDataPoint[] | MonthlyDataPoint[] | YearlyDataPoint[]> {
    const resolvedPackageName = toValue(packageName)
    const resolvedCreatedIso = toValue(createdIso) ?? null
    const resolvedOptions = toValue(evolutionOptions)

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

  async function fetchPackageLikesEvolution(
    packageName: MaybeRefOrGetter<string>,
    evolutionOptions: MaybeRefOrGetter<EvolutionOptions>,
  ): Promise<DailyDataPoint[] | WeeklyDataPoint[] | MonthlyDataPoint[] | YearlyDataPoint[]> {
    const resolvedPackageName = toValue(packageName)
    const resolvedOptions = toValue(evolutionOptions)

    // Fetch daily likes data (with client-side promise caching)
    const cache = likesEvolutionCache
    const cacheKey = resolvedPackageName

    let dailyLikesPromise: Promise<DailyRawPoint[]>

    if (cache?.has(cacheKey)) {
      dailyLikesPromise = cache.get(cacheKey)!
    } else {
      dailyLikesPromise = $fetch<Array<{ day: string; likes: number }>>(
        `/api/social/likes-evolution/${resolvedPackageName}`,
      )
        .then(data => (data ?? []).map(d => ({ day: d.day, value: d.likes })))
        .catch(error => {
          cache?.delete(cacheKey)
          throw error
        })

      cache?.set(cacheKey, dailyLikesPromise)
    }

    const sortedDaily = await dailyLikesPromise

    const { start, end } = resolveDateRange(resolvedOptions, null)
    const startIso = toIsoDateString(start)
    const endIso = toIsoDateString(end)

    const filteredDaily = sortedDaily.filter(d => d.day >= startIso && d.day <= endIso)

    if (resolvedOptions.granularity === 'day') return buildDailyEvolutionFromDaily(filteredDaily)
    if (resolvedOptions.granularity === 'week')
      return buildRollingWeeklyEvolutionFromDaily(filteredDaily, startIso, endIso)
    if (resolvedOptions.granularity === 'month')
      return buildMonthlyEvolutionFromDaily(filteredDaily)
    return buildYearlyEvolutionFromDaily(filteredDaily)
  }

  async function fetchRepoContributorsEvolution(
    repoRef: MaybeRefOrGetter<RepoRef | null | undefined>,
    evolutionOptions: MaybeRefOrGetter<EvolutionOptions>,
  ): Promise<DailyDataPoint[] | WeeklyDataPoint[] | MonthlyDataPoint[] | YearlyDataPoint[]> {
    const resolvedRepoRef = toValue(repoRef)
    if (!resolvedRepoRef || resolvedRepoRef.provider !== 'github') return []

    const resolvedOptions = toValue(evolutionOptions)

    const cache = contributorsEvolutionCache
    const cacheKey = `${resolvedRepoRef.owner}/${resolvedRepoRef.repo}`

    let statsPromise: Promise<GitHubContributorStats[]>

    if (cache?.has(cacheKey)) {
      statsPromise = cache.get(cacheKey)!
    } else {
      statsPromise = $fetch<GitHubContributorStats[]>(
        `/api/github/contributors-evolution/${resolvedRepoRef.owner}/${resolvedRepoRef.repo}`,
      )
        .then(data => (Array.isArray(data) ? data : []))
        .catch(error => {
          cache?.delete(cacheKey)
          throw error
        })

      cache?.set(cacheKey, statsPromise)
    }

    const stats = await statsPromise
    const { start, end } = resolveDateRange(resolvedOptions, null)

    const { weeklyCounts, monthlyCounts, yearlyCounts } = buildContributorCounts(stats)

    if (resolvedOptions.granularity === 'week') {
      return buildWeeklyEvolutionFromContributorCounts(weeklyCounts, start, end)
    }
    if (resolvedOptions.granularity === 'month') {
      return buildMonthlyEvolutionFromContributorCounts(monthlyCounts, start, end)
    }
    if (resolvedOptions.granularity === 'year') {
      return buildYearlyEvolutionFromContributorCounts(yearlyCounts, start, end)
    }

    return []
  }

  async function fetchRepoRefsForPackages(
    packageNames: MaybeRefOrGetter<string[]>,
  ): Promise<Record<string, RepoRef | null>> {
    const names = (toValue(packageNames) ?? []).map(n => String(n).trim()).filter(Boolean)
    if (!import.meta.client || !names.length) return {}

    const settled = await Promise.allSettled(
      names.map(async name => {
        const cacheKey = name
        const cache = repoMetaCache
        if (cache?.has(cacheKey)) {
          const ref = await cache.get(cacheKey)!
          return { name, ref }
        }

        const promise = $fetch<PackageMetaResponse>(
          `/api/registry/package-meta/${encodePackageName(name)}`,
        )
          .then(meta => {
            const repoUrl = meta?.links?.repository
            return repoUrl ? parseRepoUrl(repoUrl) : null
          })
          .catch(error => {
            cache?.delete(cacheKey)
            throw error
          })

        cache?.set(cacheKey, promise)
        const ref = await promise
        return { name, ref }
      }),
    )

    const next: Record<string, RepoRef | null> = {}
    for (const [index, entry] of settled.entries()) {
      const name = names[index]
      if (!name) continue
      if (entry.status === 'fulfilled') {
        next[name] = entry.value.ref ?? null
      } else {
        next[name] = null
      }
    }

    return next
  }

  return {
    fetchPackageDownloadEvolution,
    fetchPackageLikesEvolution,
    fetchRepoContributorsEvolution,
    fetchRepoRefsForPackages,
    getNpmPackageCreationDate,
  }
}
