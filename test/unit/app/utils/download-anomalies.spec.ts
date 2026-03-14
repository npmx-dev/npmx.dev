import { describe, expect, it } from 'vitest'
import { applyHampelCorrection } from '../../../../app/utils/download-anomalies'
import type { WeeklyDataPoint } from '../../../../app/types/chart'

function makeWeeklyPoint(weekStart: string, value: number): WeeklyDataPoint {
  return {
    value,
    weekKey: `${weekStart}_end`,
    weekStart,
    weekEnd: weekStart,
    timestampStart: 0,
    timestampEnd: 0,
  }
}

describe('applyHampelCorrection', () => {
  it('flags and corrects a spike in the middle of steady data', () => {
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-10-24', 100),
      makeWeeklyPoint('2022-10-31', 100),
      makeWeeklyPoint('2022-11-07', 100),
      makeWeeklyPoint('2022-11-14', 100),
      makeWeeklyPoint('2022-11-21', 1000), // spike (index 4)
      makeWeeklyPoint('2022-11-28', 100),
      makeWeeklyPoint('2022-12-05', 100),
      makeWeeklyPoint('2022-12-12', 100),
      makeWeeklyPoint('2022-12-19', 100),
    ]

    const result = applyHampelCorrection(data) as WeeklyDataPoint[]

    // The spike should be corrected
    expect(result[4]!.hasAnomaly).toBe(true)
    expect(result[4]!.value).toBe(100) // replaced with median

    // Non-spike points should be unchanged
    expect(result[0]!.value).toBe(100)
    expect(result[0]!.hasAnomaly).toBeUndefined()
    expect(result[3]!.value).toBe(100)
    expect(result[8]!.value).toBe(100)
  })

  it('does not flag gradual growth as anomalies', () => {
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-10-24', 80),
      makeWeeklyPoint('2022-10-31', 90),
      makeWeeklyPoint('2022-11-07', 100),
      makeWeeklyPoint('2022-11-14', 110),
      makeWeeklyPoint('2022-11-21', 120),
      makeWeeklyPoint('2022-11-28', 130),
      makeWeeklyPoint('2022-12-05', 140),
      makeWeeklyPoint('2022-12-12', 150),
      makeWeeklyPoint('2022-12-19', 160),
    ]

    const result = applyHampelCorrection(data) as WeeklyDataPoint[]

    for (const point of result) {
      expect(point.hasAnomaly).toBeUndefined()
    }
  })

  it('returns data unchanged when too few points for the window', () => {
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-11-07', 100),
      makeWeeklyPoint('2022-11-14', 1000),
      makeWeeklyPoint('2022-11-21', 100),
    ]

    const result = applyHampelCorrection(data) as WeeklyDataPoint[]
    expect(result[1]!.value).toBe(1000) // not enough data to detect
  })

  it('does not flatten a "great start" (sudden real growth at the end)', () => {
    // A package going from zero to real adoption — this is NOT a spike.
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-10-24', 0),
      makeWeeklyPoint('2022-10-31', 0),
      makeWeeklyPoint('2022-11-07', 0),
      makeWeeklyPoint('2022-11-14', 0),
      makeWeeklyPoint('2022-11-21', 0),
      makeWeeklyPoint('2022-11-28', 0),
      makeWeeklyPoint('2022-12-05', 0),
      makeWeeklyPoint('2022-12-12', 0),
      makeWeeklyPoint('2022-12-19', 20000),
    ]

    const result = applyHampelCorrection(data) as WeeklyDataPoint[]

    // The 20000 should NOT be erased — it's real growth, not an anomaly.
    expect(result[8]!.value).toBe(20000)
    expect(result[8]!.hasAnomaly).toBeUndefined()
  })

  it('does not flatten low-volume real activity', () => {
    // Sparse package with occasional real downloads
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-10-24', 0),
      makeWeeklyPoint('2022-10-31', 0),
      makeWeeklyPoint('2022-11-07', 0),
      makeWeeklyPoint('2022-11-14', 0),
      makeWeeklyPoint('2022-11-21', 1),
      makeWeeklyPoint('2022-12-05', 0),
      makeWeeklyPoint('2022-12-12', 0),
      makeWeeklyPoint('2022-12-19', 0),
      makeWeeklyPoint('2022-12-26', 0),
    ]

    const result = applyHampelCorrection(data) as WeeklyDataPoint[]

    // A single download is not an anomaly
    expect(result[4]!.value).toBe(1)
    expect(result[4]!.hasAnomaly).toBeUndefined()
  })

  it('does not mutate the original data', () => {
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-10-24', 100),
      makeWeeklyPoint('2022-10-31', 100),
      makeWeeklyPoint('2022-11-07', 100),
      makeWeeklyPoint('2022-11-14', 100),
      makeWeeklyPoint('2022-11-21', 1000),
      makeWeeklyPoint('2022-11-28', 100),
      makeWeeklyPoint('2022-12-05', 100),
      makeWeeklyPoint('2022-12-12', 100),
      makeWeeklyPoint('2022-12-19', 100),
    ]

    applyHampelCorrection(data)
    expect(data[4]!.value).toBe(1000) // original unchanged
  })
})
