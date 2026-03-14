import { describe, expect, it } from 'vitest'
import {
  fillPartialBucket,
  buildDailyEvolution,
  buildWeeklyEvolution,
  buildMonthlyEvolution,
  buildYearlyEvolution,
} from '../../../../app/utils/chart-data-buckets'

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

describe('buildDailyEvolution', () => {
  it('adds timestamps and preserves values', () => {
    const result = buildDailyEvolution([
      { day: '2025-03-01', value: 10 },
      { day: '2025-03-02', value: 20 },
    ])

    expect(result).toEqual([
      { day: '2025-03-01', value: 10, timestamp: Date.UTC(2025, 2, 1) },
      { day: '2025-03-02', value: 20, timestamp: Date.UTC(2025, 2, 2) },
    ])
  })

  it('sorts by day', () => {
    const result = buildDailyEvolution([
      { day: '2025-03-03', value: 3 },
      { day: '2025-03-01', value: 1 },
      { day: '2025-03-02', value: 2 },
    ])

    expect(result.map(r => r.day)).toEqual(['2025-03-01', '2025-03-02', '2025-03-03'])
  })

  it('returns empty array for empty input', () => {
    expect(buildDailyEvolution([])).toEqual([])
  })
})

describe('buildWeeklyEvolution', () => {
  it('groups daily data into 7-day buckets aligned from end', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `2025-03-${String(i + 1).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildWeeklyEvolution(daily, '2025-03-01', '2025-03-14')

    expect(result).toHaveLength(2)
    expect(result[0]!.value).toBe(70)
    expect(result[0]!.weekStart).toBe('2025-03-01')
    expect(result[0]!.weekEnd).toBe('2025-03-07')
    expect(result[1]!.value).toBe(70)
    expect(result[1]!.weekStart).toBe('2025-03-08')
    expect(result[1]!.weekEnd).toBe('2025-03-14')
  })

  it('scales up partial first bucket proportionally', () => {
    const daily = Array.from({ length: 10 }, (_, i) => ({
      day: `2025-03-${String(i + 1).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildWeeklyEvolution(daily, '2025-03-01', '2025-03-10')

    expect(result).toHaveLength(2)
    expect(result[0]!.value).toBe(Math.round((30 * 7) / 3))
    expect(result[0]!.weekStart).toBe('2025-03-01')
    expect(result[0]!.weekEnd).toBe('2025-03-03')
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

    const result = buildWeeklyEvolution(daily, '2025-03-01', '2025-03-09')

    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(70)
    expect(result[0]!.weekStart).toBe('2025-03-01')
    expect(result[0]!.weekEnd).toBe('2025-03-07')
  })

  it('returns empty array for empty input', () => {
    expect(buildWeeklyEvolution([], '2025-03-01', '2025-03-14')).toEqual([])
  })
})

describe('buildMonthlyEvolution', () => {
  it('aggregates daily data by month', () => {
    const result = buildMonthlyEvolution([
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
    const result = buildMonthlyEvolution([
      { day: '2025-03-01', value: 1 },
      { day: '2025-01-01', value: 1 },
      { day: '2025-02-01', value: 1 },
    ])

    expect(result.map(r => r.month)).toEqual(['2025-01', '2025-02', '2025-03'])
  })

  it('returns empty array for empty input', () => {
    expect(buildMonthlyEvolution([])).toEqual([])
  })

  it('scales single month partial on both ends without double-scaling', () => {
    // 2025-01-10 to 2025-01-20 = 11 days out of 31
    const daily = Array.from({ length: 11 }, (_, i) => ({
      day: `2025-01-${String(i + 10).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildMonthlyEvolution(daily, '2025-01-10', '2025-01-20')

    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(Math.round((110 * 31) / 11))
  })

  it('scales up partial first month', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `2025-03-${String(i + 18).padStart(2, '0')}`,
      value: 10,
    }))

    const result = buildMonthlyEvolution(daily, '2025-03-18', '2025-03-31')

    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(Math.round((140 * 31) / 14))
  })

  it('scales up partial last month', () => {
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

    const result = buildMonthlyEvolution(daily, '2025-01-01', '2025-02-09')

    expect(result).toHaveLength(2)
    expect(result[0]!.value).toBe(310)
    expect(result[1]!.value).toBe(Math.round((90 * 28) / 9))
  })
})

describe('buildYearlyEvolution', () => {
  it('aggregates daily data by year', () => {
    const result = buildYearlyEvolution([
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
    expect(buildYearlyEvolution([])).toEqual([])
  })

  it('scales single year partial on both ends without double-scaling', () => {
    // 2025-04-01 to 2025-06-30 = 91 days out of 365
    const daily = Array.from({ length: 91 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 3, 1))
      d.setUTCDate(d.getUTCDate() + i)
      return { day: d.toISOString().slice(0, 10), value: 10 }
    })

    const result = buildYearlyEvolution(daily, '2025-04-01', '2025-06-30')

    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(Math.round((910 * 365) / 91))
  })

  it('scales up partial first year', () => {
    const daily = Array.from({ length: 184 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 6, 1))
      d.setUTCDate(d.getUTCDate() + i)
      return { day: d.toISOString().slice(0, 10), value: 10 }
    })

    const result = buildYearlyEvolution(daily, '2025-07-01', '2025-12-31')

    expect(result).toHaveLength(1)
    expect(result[0]!.value).toBe(Math.round((1840 * 365) / 184))
  })
})
