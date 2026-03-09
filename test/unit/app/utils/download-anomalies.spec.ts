import { describe, expect, it } from 'vitest'
import { applyBlocklistCorrection } from '../../../../app/utils/download-anomalies'
import type { WeeklyDataPoint } from '../../../../app/types/chart'

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
})
