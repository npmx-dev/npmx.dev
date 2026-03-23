import type { MonthlyDataPoint, WeeklyDataPoint, YearlyDataPoint } from '~/types/chart'
import { describe, expect, it } from 'vitest'
import { applyBlocklistCorrection } from '~/utils/download-anomalies'

/** Helper to build a WeeklyDataPoint from a start date and value. */
function week(weekStart: string, value: number): WeeklyDataPoint {
  const start = new Date(`${weekStart}T00:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const weekEnd = end.toISOString().slice(0, 10)
  return {
    value,
    weekKey: `${weekStart}_${weekEnd}`,
    weekStart,
    weekEnd,
    timestampStart: start.getTime(),
    timestampEnd: end.getTime(),
  }
}

function month(monthStr: string, value: number): MonthlyDataPoint {
  return {
    value,
    month: monthStr,
    timestamp: new Date(`${monthStr}-01T00:00:00Z`).getTime(),
  }
}

function year(yearStr: string, value: number): YearlyDataPoint {
  return {
    value,
    year: yearStr,
    timestamp: new Date(`${yearStr}-01-01T00:00:00Z`).getTime(),
  }
}

describe('applyBlocklistCorrection', () => {
  // Anomaly Nov 2022: start=2022-11-15, end=2022-11-30
  it('corrects weeks overlapping the anomaly', () => {
    const data = [
      week('2022-11-07', 100),
      week('2022-11-14', 999),
      week('2022-11-21', 999),
      week('2022-11-28', 999),
      week('2022-12-05', 200),
    ]

    expect(
      applyBlocklistCorrection({
        data,
        packageName: 'svelte',
        granularity: 'weekly',
      }),
    ).toEqual([
      data[0],
      { ...data[1], value: 125, hasAnomaly: true },
      { ...data[2], value: 150, hasAnomaly: true },
      { ...data[3], value: 175, hasAnomaly: true },
      data[4],
    ])
  })

  // Anomaly Jun 2023: start=2023-06-19, end=2023-06-22
  it('does not over-correct a week starting on the anomaly end boundary', () => {
    const data = [
      week('2023-06-01', 500_000),
      week('2023-06-08', 500_000),
      week('2023-06-15', 10_000_000), // contains spike
      week('2023-06-22', 500_000), // starts on anomaly end boundary — normal!
      week('2023-06-29', 500_000),
    ]

    const result = applyBlocklistCorrection({
      data,
      packageName: 'svelte',
      granularity: 'weekly',
    }) as WeeklyDataPoint[]

    // The spike week must be corrected
    expect(result[2]!.hasAnomaly).toBe(true)
    expect(result[2]!.value).toBeLessThan(1_000_000)

    // The boundary week must NOT be modified
    expect(result[3]!.value).toBe(500_000)
    expect(result[3]!.hasAnomaly).toBeUndefined()
  })

  it('does not over-correct a week ending on the anomaly start boundary', () => {
    const data = [
      week('2023-06-13', 500_000), // ends on anomaly start boundary — normal!
      week('2023-06-20', 10_000_000), // contains spike
      week('2023-06-27', 500_000),
    ]

    const result = applyBlocklistCorrection({
      data,
      packageName: 'svelte',
      granularity: 'weekly',
    }) as WeeklyDataPoint[]

    // The boundary week must NOT be modified
    expect(result[0]!.value).toBe(500_000)
    expect(result[0]!.hasAnomaly).toBeUndefined()

    // The spike week must be corrected
    expect(result[1]!.hasAnomaly).toBe(true)
    expect(result[1]!.value).toBeLessThan(1_000_000)
  })

  // Vite anomaly: start=2025-08-04, end=2025-09-08 (spans Aug-Sep)
  it('does not over-correct a month that only touches the anomaly end boundary', () => {
    const data = [
      month('2025-07', 30_000_000),
      month('2025-08', 100_000_000), // contains spike
      month('2025-09', 100_000_000), // contains spike (Sep 1-7)
      month('2025-10', 30_000_000), // after anomaly end — normal!
    ]

    const result = applyBlocklistCorrection({
      data,
      packageName: 'vite',
      granularity: 'monthly',
    }) as MonthlyDataPoint[]

    expect(result[1]!.hasAnomaly).toBe(true)
    expect(result[2]!.hasAnomaly).toBe(true)

    // October must NOT be modified
    expect(result[3]!.value).toBe(30_000_000)
    expect(result[3]!.hasAnomaly).toBeUndefined()
  })

  it('does not over-correct a month that only touches the anomaly start boundary', () => {
    const data = [
      month('2025-07', 30_000_000), // before anomaly start — normal!
      month('2025-08', 100_000_000), // contains spike
      month('2025-09', 100_000_000), // contains spike
      month('2025-10', 30_000_000),
    ]

    const result = applyBlocklistCorrection({
      data,
      packageName: 'vite',
      granularity: 'monthly',
    }) as MonthlyDataPoint[]

    // July must NOT be modified
    expect(result[0]!.value).toBe(30_000_000)
    expect(result[0]!.hasAnomaly).toBeUndefined()

    expect(result[1]!.hasAnomaly).toBe(true)
    expect(result[2]!.hasAnomaly).toBe(true)
  })

  it('does not over-correct a year that only touches the anomaly boundary', () => {
    const data = [
      year('2024', 500_000_000),
      year('2025', 2_000_000_000), // contains spike
      year('2026', 500_000_000),
    ]

    const result = applyBlocklistCorrection({
      data,
      packageName: 'vite',
      granularity: 'yearly',
    }) as YearlyDataPoint[]

    // 2024 must NOT be modified
    expect(result[0]!.value).toBe(500_000_000)
    expect(result[0]!.hasAnomaly).toBeUndefined()

    // 2025 must be corrected
    expect(result[1]!.hasAnomaly).toBe(true)

    // 2026 must NOT be modified
    expect(result[2]!.value).toBe(500_000_000)
    expect(result[2]!.hasAnomaly).toBeUndefined()
  })
})
