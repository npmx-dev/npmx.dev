import type { EvolutionOptions } from '~/types/chart'

import { mapWithConcurrency } from '#shared/utils/async'

import {
  buildDailyEvolution,
  buildMonthlyEvolution,
  buildWeeklyEvolution,
  buildYearlyEvolution,
} from '~/utils/chart-data-buckets'

import { addDays, parseIsoDate, toIsoDate } from '~/utils/date'

import {
  mergeDailyPoints,
  splitIsoRangeIntoChunksInclusive,
} from '../../shared/utils/download-ranges'

type DailyDownloadPoint = {
  day: string
  value: number
}

type NpmDownloadsRangeResponse = {
  downloads: Array<{
    day: string
    downloads: number
  }>
}

function toDateOnly(value?: string): string | null {
  if (!value) {
    return null
  }

  const dateOnly = value.slice(0, 10)

  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function startOfUtcYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
}

function resolveDateRange(evolutionOptions: EvolutionOptions, packageCreatedIso: string | null) {
  const today = new Date()

  const yesterday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  )

  const endDateOnly = toDateOnly(evolutionOptions.endDate)

  const end = endDateOnly ? parseIsoDate(endDateOnly) : yesterday

  const startDateOnly = toDateOnly(evolutionOptions.startDate)

  if (startDateOnly) {
    return {
      start: parseIsoDate(startDateOnly),
      end,
    }
  }

  let start: Date

  if (evolutionOptions.granularity === 'year') {
    start = packageCreatedIso
      ? startOfUtcYear(new Date(packageCreatedIso))
      : addDays(end, -(5 * 365) + 1)
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

    start = addDays(end, -(weekCount * 7) + 1)
  } else {
    start = addDays(end, -29)
  }

  return {
    start,
    end,
  }
}

async function fetchNpmDownloadsRangeServer(
  packageName: string,
  startIso: string,
  endIso: string,
): Promise<NpmDownloadsRangeResponse> {
  const encodedName = encodeURIComponent(packageName)

  return await $fetch<NpmDownloadsRangeResponse>(
    `https://api.npmjs.org/downloads/range/${startIso}:${endIso}/${encodedName}`,
  )
}

async function fetchDailyRange(
  packageName: string,
  startIso: string,
  endIso: string,
): Promise<DailyDownloadPoint[]> {
  const response = await fetchNpmDownloadsRangeServer(packageName, startIso, endIso)
  const downloads = Array.isArray(response?.downloads) ? response.downloads : []

  return downloads
    .slice()
    .sort((a, b) => a.day.localeCompare(b.day))
    .map(download => ({
      day: download.day,
      value: Number(download.downloads) || 0,
    }))
}

async function fetchDailyRangeChunked(
  packageName: string,
  startIso: string,
  endIso: string,
): Promise<DailyDownloadPoint[]> {
  const maximumDaysPerRequest = 540

  const ranges = splitIsoRangeIntoChunksInclusive(startIso, endIso, maximumDaysPerRequest)

  if (ranges.length === 1) {
    return fetchDailyRange(packageName, startIso, endIso)
  }

  const parts = await mapWithConcurrency(
    ranges,
    range => fetchDailyRange(packageName, range.startIso, range.endIso),
    10,
  )

  return mergeDailyPoints(parts.flat())
}

export async function fetchDownloadsEvolution(
  packageName: string,
  evolutionOptions: EvolutionOptions,
  packageCreatedIso: string | null = null,
) {
  const { start, end } = resolveDateRange(evolutionOptions, packageCreatedIso)

  const startIso = toIsoDate(start)
  const endIso = toIsoDate(end)

  const dailyData = await fetchDailyRangeChunked(packageName, startIso, endIso)

  switch (evolutionOptions.granularity) {
    case 'year':
      return buildYearlyEvolution(dailyData, startIso, endIso)

    case 'month':
      return buildMonthlyEvolution(dailyData, startIso, endIso)

    case 'week':
      return buildWeeklyEvolution(dailyData, startIso, endIso)

    case 'day':
    default:
      return buildDailyEvolution(dailyData)
  }
}
