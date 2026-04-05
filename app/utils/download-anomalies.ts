import type { ChartTimeGranularity, EvolutionData } from '~/types/chart'
import { DOWNLOAD_ANOMALIES } from './download-anomalies.data'

export type DownloadAnomalyBound = {
  date: string // YYYY-MM-DD
  weeklyDownloads: number
}

export type DownloadAnomaly = {
  packageName: string
  start: DownloadAnomalyBound
  end: DownloadAnomalyBound
}

function getDateString(point: Record<string, any>, granularity: ChartTimeGranularity): string {
  switch (granularity) {
    case 'daily':
      return point.day
    case 'weekly':
      return point.weekStart
    case 'monthly':
      return `${point.month}-01`
    case 'yearly':
      return `${point.year}-01-01`
  }
}

/**
 * For daily the point date falls strictly between the anomaly bounds.
 * For weekly the point date is the week start, and the full 7-day range is
 * checked so any overlapping week is affected.
 * For monthly/yearly the anomaly bounds are truncated to the same resolution
 * so that any period overlapping the anomaly is caught (inclusive).
 */
function isDateAffected(
  date: string,
  anomaly: DownloadAnomaly,
  granularity: ChartTimeGranularity,
): boolean {
  switch (granularity) {
    case 'daily':
      return date > anomaly.start.date && date < anomaly.end.date
    case 'weekly': {
      const startWeek = date
      const weekStartDate = new Date(`${date}T00:00:00Z`)
      const weekEndDate = new Date(weekStartDate)
      weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6)
      const endWeek = weekEndDate.toISOString().slice(0, 10)
      return startWeek < anomaly.end.date && endWeek > anomaly.start.date
    }
    case 'monthly': {
      const monthStart = date
      const monthStartDate = new Date(`${date}T00:00:00Z`)
      const monthEndDate = new Date(monthStartDate)
      monthEndDate.setUTCMonth(monthEndDate.getUTCMonth() + 1)
      monthEndDate.setUTCDate(monthEndDate.getUTCDate() - 1)
      const monthEnd = monthEndDate.toISOString().slice(0, 10)
      return monthStart < anomaly.end.date && monthEnd > anomaly.start.date
    }
    case 'yearly': {
      const yearStart = date
      const yearEnd = `${date.slice(0, 4)}-12-31`
      return yearStart < anomaly.end.date && yearEnd > anomaly.start.date
    }
  }
}

function scaleWeeklyValue(weeklyValue: number, granularity: ChartTimeGranularity): number {
  switch (granularity) {
    case 'daily':
      return Math.round(weeklyValue / 7)
    case 'weekly':
      return weeklyValue
    case 'monthly':
      return Math.round((weeklyValue / 7) * 30)
    case 'yearly':
      return Math.round((weeklyValue / 7) * 365)
  }
}

export function getAnomaliesForPackages(
  packageNames: string[],
): { packageName: string; start: string; end: string }[] {
  return DOWNLOAD_ANOMALIES.filter(a => packageNames.includes(a.packageName)).map(a => ({
    packageName: a.packageName,
    start: a.start.date,
    end: a.end.date,
  }))
}

export function applyBlocklistCorrection(opts: {
  data: EvolutionData
  packageName: string
  granularity: ChartTimeGranularity
}): EvolutionData {
  const { data, packageName, granularity } = opts
  const anomalies = DOWNLOAD_ANOMALIES.filter(a => a.packageName === packageName)
  if (!anomalies.length) return data

  // Clone to avoid mutation
  const result = (data as Array<Record<string, any>>).map(d => Object.assign({}, d))

  for (const anomaly of anomalies) {
    // Find indices of affected points
    const affectedIndices: number[] = []
    for (let i = 0; i < result.length; i++) {
      const date = getDateString(result[i]!, granularity)
      if (isDateAffected(date, anomaly, granularity)) {
        affectedIndices.push(i)
      }
    }

    if (!affectedIndices.length) continue

    const firstAffected = affectedIndices[0]!
    const lastAffected = affectedIndices[affectedIndices.length - 1]!

    // Use neighbors when available, fall back to scaled weeklyDownloads
    const scaledStart = scaleWeeklyValue(anomaly.start.weeklyDownloads, granularity)
    const scaledEnd = scaleWeeklyValue(anomaly.end.weeklyDownloads, granularity)

    const startVal = firstAffected > 0 ? result[firstAffected - 1]!.value : scaledStart
    const endVal = lastAffected < result.length - 1 ? result[lastAffected + 1]!.value : scaledEnd

    const count = affectedIndices.length
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1)
      result[affectedIndices[i]!]!.value = Math.round(startVal + t * (endVal - startVal))
      result[affectedIndices[i]!]!.hasAnomaly = true
    }
  }
  return result as EvolutionData
}
