import { describe, expect, it, vi } from 'vitest'

vi.mock('~/utils/chart-data-correction', () => ({
  applyDataCorrection: (data: { value: number }[]) => data,
}))

import {
    endDateOnlyToUtcMs,
    getBucketStartUtc,
    getBucketEndUtc,
    getCompletionRatio,
    linearProject,
    extrapolateLastValue,
} from '../../../../app/utils/chart-data-prediction'

describe('endDateOnlyToUtcMs', () => {
  it('parses a valid date', () => {
    expect(endDateOnlyToUtcMs('2025-03-15')).toBe(Date.UTC(2025, 2, 15, 23, 59, 59, 999))
  })

  it('returns null for invalid formats', () => {
    expect(endDateOnlyToUtcMs('not-a-date')).toBeNull()
    expect(endDateOnlyToUtcMs('2025/03/15')).toBeNull()
    expect(endDateOnlyToUtcMs('')).toBeNull()
  })
})

describe('getBucketStartUtc', () => {
  // Friday 2025-11-07 at 06:05:04
  const ts = Date.UTC(2025, 10, 7, 6, 5, 4)

  it('yearly → Jan 1st', () => {
    expect(getBucketStartUtc(ts, 'yearly')).toBe(Date.UTC(2025, 0, 1))
  })

  it('monthly → 1st of month', () => {
    expect(getBucketStartUtc(ts, 'monthly')).toBe(Date.UTC(2025, 10, 1))
  })

  it('weekly → previous Monday', () => {
    expect(getBucketStartUtc(ts, 'weekly')).toBe(Date.UTC(2025, 10, 3))
  })

  it('weekly on a Monday returns that Monday', () => {
    const monday = Date.UTC(2025, 10, 3, 6, 5, 4)
    expect(getBucketStartUtc(monday, 'weekly')).toBe(Date.UTC(2025, 10, 3))
  })

  it('weekly on a Sunday returns previous Monday', () => {
    const sunday = Date.UTC(2025, 10, 9, 6, 5, 4)
    expect(getBucketStartUtc(sunday, 'weekly')).toBe(Date.UTC(2025, 10, 3))
  })

  it('daily → start of day', () => {
    expect(getBucketStartUtc(ts, 'daily')).toBe(Date.UTC(2025, 10, 7))
  })
})

describe('getBucketEndUtc', () => {
  // Friday 2025-11-07 at 06:05:04
  const ts = Date.UTC(2025, 10, 7, 6, 5, 4)

  it('yearly → Jan 1st next year', () => {
    expect(getBucketEndUtc(ts, 'yearly')).toBe(Date.UTC(2026, 0, 1))
  })

  it('monthly → 1st of next month', () => {
    expect(getBucketEndUtc(ts, 'monthly')).toBe(Date.UTC(2025, 11, 1))
  })

  it('weekly → Monday + 7 days', () => {
    expect(getBucketEndUtc(ts, 'weekly')).toBe(Date.UTC(2025, 10, 10))
  })

  it('daily → next day', () => {
    expect(getBucketEndUtc(ts, 'daily')).toBe(Date.UTC(2025, 10, 8))
  })
})

describe('getCompletionRatio', () => {
  it('returns 0 at bucket start', () => {
    const start = Date.UTC(2025, 2, 1)
    expect(getCompletionRatio(start, 'monthly', start)).toBe(0)
  })

  it('returns 1 at bucket end', () => {
    const start = Date.UTC(2025, 2, 1)
    const end = Date.UTC(2025, 3, 1)
    expect(getCompletionRatio(start, 'monthly', end)).toBe(1)
  })

  it('returns ~0.5 at midpoint', () => {
    const start = Date.UTC(2025, 0, 1)
    const mid = Date.UTC(2025, 0, 1, 12, 0)
    expect(getCompletionRatio(start, 'daily', mid)).toBeCloseTo(0.5)
  })

  it('clamps to [0, 1]', () => {
    const start = Date.UTC(2025, 2, 1)
    expect(getCompletionRatio(start, 'monthly', start - 1000)).toBe(0)
    expect(getCompletionRatio(start, 'monthly', Date.UTC(2025, 5, 1))).toBe(1)
  })
})

describe('linearProject', () => {
  it('returns null with fewer than 2 points', () => {
    expect(linearProject([])).toBeNull()
    expect(linearProject([5])).toBeNull()
  })

  it('projects a linear trend', () => {
    expect(linearProject([10, 20, 30])).toBeCloseTo(40)
  })

  it('floors negative projections to 0', () => {
    expect(linearProject([100, 10, 1])).toBe(0)
  })

  it('handles constant series', () => {
    expect(linearProject([5, 5, 5])).toBeCloseTo(5)
  })
})

describe('extrapolateLastValue', () => {
  it('returns raw last value when ratio >= 1 (complete bucket)', () => {
    const result = extrapolateLastValue({
      series: [100, 200, 150],
      granularity: 'monthly',
      lastDateMs: Date.UTC(2025, 1, 1),
      referenceMs: Date.UTC(2025, 2, 1),
      predictionPoints: 4,
    })
    expect(result).toBe(150)
  })

  it('returns raw last value when predictionPoints <= 0', () => {
    const result = extrapolateLastValue({
      series: [100, 200, 50],
      granularity: 'monthly',
      lastDateMs: Date.UTC(2025, 2, 1),
      referenceMs: Date.UTC(2025, 2, 15),
      predictionPoints: 0,
    })
    expect(result).toBe(50)
  })

  it('uses linear projection when lookback >= predictionPoints', () => {
    // 4 lookback points, predictionPoints = 4 → linear projection
    const result = extrapolateLastValue({
      series: [100, 200, 300, 400, 50],
      granularity: 'monthly',
      lastDateMs: Date.UTC(2025, 3, 1),
      referenceMs: Date.UTC(2025, 3, 15),
      predictionPoints: 4,
    })
    expect(result).toBeCloseTo(500)
  })

  it('falls back to scale-up when lookback < predictionPoints', () => {
    // 2 lookback points but predictionPoints = 4 → scale-up
    const result = extrapolateLastValue({
      series: [100, 200, 50],
      granularity: 'monthly',
      lastDateMs: Date.UTC(2025, 2, 1),
      referenceMs: Date.UTC(2025, 2, 16),
      predictionPoints: 4,
    })
    // ratio ≈ 15/31, scaled ≈ 50 / (15/31) ≈ 103.3
    expect(result).toBeGreaterThan(50)
    expect(result).toBeLessThan(200)
  })

  it('falls back to scale-up with no lookback', () => {
    const result = extrapolateLastValue({
      series: [50],
      granularity: 'daily',
      lastDateMs: Date.UTC(2025, 2, 12),
      referenceMs: Date.UTC(2025, 2, 12, 12, 0),
      predictionPoints: 4,
    })
    expect(result).toBeCloseTo(100)
  })

  it('yearly with few points uses scale-up', () => {
    // 2 complete years + partial 2025, predictionPoints = 4 → scale-up
    const result = extrapolateLastValue({
      series: [1000, 2000, 500],
      granularity: 'yearly',
      lastDateMs: Date.UTC(2025, 0, 1),
      referenceMs: Date.UTC(2025, 2, 10),
      predictionPoints: 4,
    })
    // ~69 days into the year, ratio ≈ 0.19 → scaled ≈ 500 / 0.19 ≈ 2632
    expect(result).toBeGreaterThan(2000)
  })
})
