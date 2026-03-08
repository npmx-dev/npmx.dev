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
      makeWeeklyPoint('2022-11-07', 100),
      makeWeeklyPoint('2022-11-14', 100),
      makeWeeklyPoint('2022-11-21', 100),
      makeWeeklyPoint('2022-11-28', 1000), // spike
      makeWeeklyPoint('2022-12-05', 100),
      makeWeeklyPoint('2022-12-12', 100),
      makeWeeklyPoint('2022-12-19', 100),
    ]

    const result = applyHampelCorrection(data) as WeeklyDataPoint[]

    // The spike should be corrected
    expect(result[3]!.hasAnomaly).toBe(true)
    expect(result[3]!.value).toBe(100) // replaced with median

    // Non-spike points should be unchanged
    expect(result[0]!.value).toBe(100)
    expect(result[0]!.hasAnomaly).toBeUndefined()
    expect(result[1]!.value).toBe(100)
    expect(result[6]!.value).toBe(100)
  })

  it('does not flag gradual growth as anomalies', () => {
    const data: WeeklyDataPoint[] = [
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

  it('does not mutate the original data', () => {
    const data: WeeklyDataPoint[] = [
      makeWeeklyPoint('2022-11-07', 100),
      makeWeeklyPoint('2022-11-14', 100),
      makeWeeklyPoint('2022-11-21', 100),
      makeWeeklyPoint('2022-11-28', 1000),
      makeWeeklyPoint('2022-12-05', 100),
      makeWeeklyPoint('2022-12-12', 100),
      makeWeeklyPoint('2022-12-19', 100),
    ]

    applyHampelCorrection(data)
    expect(data[3]!.value).toBe(1000) // original unchanged
  })
})
