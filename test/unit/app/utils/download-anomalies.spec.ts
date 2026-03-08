import { describe, expect, it } from 'vitest'
import { applyBlocklistCorrection } from '../../../../app/utils/download-anomalies'
import type { WeeklyDataPoint } from '../../../../app/types/chart'

describe('applyBlocklistCorrection', () => {
  it('treats overlapping weekly buckets as affected anomalies', () => {
    const data: WeeklyDataPoint[] = [
      {
        value: 100,
        weekKey: '2022-11-07_2022-11-13',
        weekStart: '2022-11-07',
        weekEnd: '2022-11-13',
        timestampStart: 0,
        timestampEnd: 0,
      },
      {
        value: 999,
        weekKey: '2022-11-14_2022-11-20',
        weekStart: '2022-11-14',
        weekEnd: '2022-11-20',
        timestampStart: 0,
        timestampEnd: 0,
      },
      {
        value: 999,
        weekKey: '2022-11-21_2022-11-27',
        weekStart: '2022-11-21',
        weekEnd: '2022-11-27',
        timestampStart: 0,
        timestampEnd: 0,
      },
      {
        value: 999,
        weekKey: '2022-11-28_2022-12-04',
        weekStart: '2022-11-28',
        weekEnd: '2022-12-04',
        timestampStart: 0,
        timestampEnd: 0,
      },
      {
        value: 200,
        weekKey: '2022-12-05_2022-12-11',
        weekStart: '2022-12-05',
        weekEnd: '2022-12-11',
        timestampStart: 0,
        timestampEnd: 0,
      },
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
})
