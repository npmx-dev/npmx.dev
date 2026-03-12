import { describe, expect, it, vi } from 'vitest'

vi.mock('~/utils/npm/api', () => ({
  fetchNpmDownloadsRange: vi.fn(),
}))

import {
  buildDailyEvolutionFromDaily,
  buildRollingWeeklyEvolutionFromDaily,
  buildMonthlyEvolutionFromDaily,
  buildYearlyEvolutionFromDaily,
  getNpmPackageCreationDate,
  fillPartialBucket,
} from '../../../../app/composables/useCharts'

describe('buildDailyEvolutionFromDaily', () => {
  it('adds timestamps and preserves values', () => {
    const result = buildDailyEvolutionFromDaily([
      { day: '2025-03-01', value: 10 },
      { day: '2025-03-02', value: 20 },
    ])

    expect(result).toEqual([
      { day: '2025-03-01', value: 10, timestamp: Date.UTC(2025, 2, 1) },
      { day: '2025-03-02', value: 20, timestamp: Date.UTC(2025, 2, 2) },
    ])
  })

  it('sorts by day', () => {
    const result = buildDailyEvolutionFromDaily([
      { day: '2025-03-03', value: 3 },
      { day: '2025-03-01', value: 1 },
      { day: '2025-03-02', value: 2 },
    ])

    expect(result.map(r => r.day)).toEqual(['2025-03-01', '2025-03-02', '2025-03-03'])
  })

  it('returns empty array for empty input', () => {
    expect(buildDailyEvolutionFromDaily([])).toEqual([])
  })
})

describe('buildRollingWeeklyEvolutionFromDaily', () => {
  it('groups daily data into 7-day buckets aligned from end', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `2025-03-${String(i + 1).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildRollingWeeklyEvolutionFromDaily(daily, '2025-03-01', '2025-03-14')

    expect(result).toHaveLength(2)
    // Buckets built from end (Mar 14) backwards: [Mar 1–7, Mar 8–14]
    expect(result[0]!.value).toBe(70)
    expect(result[0]!.weekStart).toBe('2025-03-01')
    expect(result[0]!.weekEnd).toBe('2025-03-07')
    expect(result[1]!.value).toBe(70)
    expect(result[1]!.weekStart).toBe('2025-03-08')
    expect(result[1]!.weekEnd).toBe('2025-03-14') // last bucket is always complete
  })

  it('scales up partial first bucket proportionally', () => {
    // 10 days = 1 full week (Mar 4-10) + 3 partial days (Mar 1-3) at start
    const daily = Array.from({ length: 10 }, (_, i) => ({
      day: `2025-03-${String(i + 1).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildRollingWeeklyEvolutionFromDaily(daily, '2025-03-01', '2025-03-10')

    expect(result).toHaveLength(2)
    // First bucket: 3 days (Mar 1-3) with value 30, scaled up to 7 days → 70
    expect(result[0]!.value).toBe(Math.round((30 * 7) / 3))
    expect(result[0]!.weekStart).toBe('2025-03-01')
    expect(result[0]!.weekEnd).toBe('2025-03-03')
    // Second bucket: full 7 days
    expect(result[1]!.value).toBe(70)
    expect(result[1]!.weekStart).toBe('2025-03-04')
    expect(result[1]!.weekEnd).toBe('2025-03-10')
  })

  it('aligns from last non-zero data day, ignoring trailing zeros', () => {
    const daily = [
      { day: '2025-03-01', value: 10 },
      { day: '2025-03-02', value: 10 },
      { day: '2025-03-03', value: 10 },
      { day: '2025-03-04', value: 10 },
      { day: '2025-03-05', value: 10 },
      { day: '2025-03-06', value: 10 },
      { day: '2025-03-07', value: 10 },
      { day: '2025-03-08', value: 0 },
      { day: '2025-03-09', value: 0 },
    ]

    // End date is Mar 09 but last real data is Mar 07
    const result = buildRollingWeeklyEvolutionFromDaily(daily, '2025-03-01', '2025-03-09')

    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(70)
    expect(result[0]!.weekStart).toBe('2025-03-01')
    expect(result[0]!.weekEnd).toBe('2025-03-07')
  })

  it('returns empty array for empty input', () => {
    expect(buildRollingWeeklyEvolutionFromDaily([], '2025-03-01', '2025-03-14')).toEqual([])
  })
})

describe('buildMonthlyEvolutionFromDaily', () => {
  it('aggregates daily data by month', () => {
    const result = buildMonthlyEvolutionFromDaily([
      { day: '2025-01-15', value: 10 },
      { day: '2025-01-20', value: 5 },
      { day: '2025-02-10', value: 20 },
    ])

    expect(result).toEqual([
      { month: '2025-01', value: 15, timestamp: Date.UTC(2025, 0, 1) },
      { month: '2025-02', value: 20, timestamp: Date.UTC(2025, 1, 1) },
    ])
  })

  it('sorts by month', () => {
    const result = buildMonthlyEvolutionFromDaily([
      { day: '2025-03-01', value: 1 },
      { day: '2025-01-01', value: 1 },
      { day: '2025-02-01', value: 1 },
    ])

    expect(result.map(r => r.month)).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('returns empty array for empty input', () => {
    expect(buildMonthlyEvolutionFromDaily([])).toEqual([])
  })

  it('scales up partial first month', () => {
    // Start on Mar 18 → only 14 days of March (18-31)
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `2025-03-${String(i + 18).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildMonthlyEvolutionFromDaily(daily, '2025-03-18', '2025-03-31')

    expect(result).toHaveLength(1)
    // 140 raw, scaled: 140 * 31 / 14 = 310
    expect(result[0]!.value).toBe(Math.round((140 * 31) / 14))
  })

  it('scales up partial last month', () => {
    // Full January + 9 days of February
    const daily = [
      ...Array.from({ length: 31 }, (_, i) => ({
        day: `2025-01-${String(i + 1).padStart(2, '0')}`,
        value: 10,
      })),
      ...Array.from({ length: 9 }, (_, i) => ({
        day: `2025-02-${String(i + 1).padStart(2, '0')}`,
        value: 10,
      })),
    ]

    const result = buildMonthlyEvolutionFromDaily(daily, '2025-01-01', '2025-02-09')

    expect(result).toHaveLength(2)
    expect(result[0]!.value).toBe(310) // full month, no scaling
    // Feb: 90 raw, scaled: 90 * 28 / 9 = 280
    expect(result[1]!.value).toBe(Math.round((90 * 28) / 9))
  })
})

describe('buildYearlyEvolutionFromDaily', () => {
  it('aggregates daily data by year', () => {
    const result = buildYearlyEvolutionFromDaily([
      { day: '2024-06-15', value: 100 },
      { day: '2024-12-01', value: 50 },
      { day: '2025-03-01', value: 200 },
    ])

    expect(result).toEqual([
      { year: '2024', value: 150, timestamp: Date.UTC(2024, 0, 1) },
      { year: '2025', value: 200, timestamp: Date.UTC(2025, 0, 1) },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(buildYearlyEvolutionFromDaily([])).toEqual([])
  })

  it('scales up partial first year', () => {
    // Start on Jul 1 → 184 days of 2025 (Jul 1 - Dec 31)
    const daily = Array.from({ length: 184 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 6, 1))
      d.setUTCDate(d.getUTCDate() + i)
      return { day: d.toISOString().slice(0, 10), value: 10 }
    })

    const result = buildYearlyEvolutionFromDaily(daily, '2025-07-01', '2025-12-31')

    expect(result).toHaveLength(1)
    // 1840 raw, scaled: 1840 * 365 / 184
    expect(result[0]!.value).toBe(Math.round((1840 * 365) / 184))
  })
})

describe('fillPartialBucket', () => {
  it('scales proportionally', () => {
    expect(fillPartialBucket(100, 3, 7)).toBe(Math.round((100 * 7) / 3))
  })

  it('returns raw value when bucket is full', () => {
    expect(fillPartialBucket(100, 7, 7)).toBe(100)
  })

  it('returns raw value when actualDays is 0', () => {
    expect(fillPartialBucket(0, 0, 7)).toBe(0)
  })
})

describe('getNpmPackageCreationDate', () => {
  it('returns created date from packument time', () => {
    const result = getNpmPackageCreationDate({
      time: {
        'created': '2020-01-15T10:00:00.000Z',
        'modified': '2025-01-01T00:00:00.000Z',
        '1.0.0': '2020-01-15T10:00:00.000Z',
      },
    })

    expect(result).toBe('2020-01-15T10:00:00.000Z')
  })

  it('returns earliest version date when created is missing', () => {
    const result = getNpmPackageCreationDate({
      time: {
        'modified': '2025-01-01T00:00:00.000Z',
        '1.0.0': '2020-06-01T00:00:00.000Z',
        '2.0.0': '2021-01-01T00:00:00.000Z',
      },
    })

    expect(result).toBe('2020-06-01T00:00:00.000Z')
  })

  it('returns null when time is missing', () => {
    expect(getNpmPackageCreationDate({})).toBeNull()
  })
})
