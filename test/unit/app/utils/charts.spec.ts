import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  sum,
  chunkIntoWeeks,
  buildWeeklyEvolutionFromDaily,
  clamp,
  quantile,
  winsorize,
  computeLineChartAnalysis,
  createAltTextForTrendLineChart,
  copyAltTextForTrendLineChart,
  createAltTextForVersionsBarChart,
  copyAltTextForVersionsBarChart,
  loadFile,
  sanitise,
  insertLineBreaks,
  applyEllipsis,
  createSeedNumber,
  createSeededSvgPattern,
  createChartPatternSlotMarkup,
  type TrendLineConfig,
  type TrendLineDataset,
  type VersionsBarConfig,
  type VersionsBarDataset,
} from '~/utils/charts'
import type { AltCopyArgs } from 'vue-data-ui'

type TranslateCall = { key: string | number; named?: Record<string, unknown> }

function createTranslateMock() {
  const calls: TranslateCall[] = []

  const translate = ((key: string | number, named?: Record<string, unknown>) => {
    calls.push({ key, named })
    return typeof key === 'string' ? `t:${key}` : `t:${String(key)}`
  }) as TrendLineConfig['$t']

  return { translate, calls }
}

function createTrendLineConfig(overrides: Partial<TrendLineConfig> = {}): TrendLineConfig {
  const { translate } = createTranslateMock()

  const trendLineConfig: TrendLineConfig = {
    formattedDates: [
      { text: '2026-03-01', absoluteIndex: 0 },
      { text: '2026-03-10', absoluteIndex: 9 },
    ],
    hasEstimation: false,
    formattedDatasetValues: [['1', '2']],
    granularity: 'weekly',
    copy: vi.fn(async () => undefined),
    $t: translate,
    numberFormatter: (value: number) => `nf:${value}`,
  } as unknown as TrendLineConfig

  return { ...trendLineConfig, ...overrides }
}

function createDatasetWithSingleLine(values: Array<number | null>): TrendLineDataset {
  return {
    lines: [
      {
        name: 'nuxt',
        series: values,
      } as any,
    ],
  }
}

function createDatasetWithTwoLines(
  firstValues: Array<number | null>,
  secondValues: Array<number | null>,
): TrendLineDataset {
  return {
    lines: [
      { name: 'nuxt', series: firstValues } as any,
      { name: 'svelte', series: secondValues } as any,
    ],
  }
}

function createConfig(overrides: Partial<TrendLineConfig> = {}): TrendLineConfig {
  const config: TrendLineConfig = {
    theme: 'dark',
    chart: {},
    formattedDates: [],
    hasEstimation: false,
    formattedDatasetValues: [],
    granularity: 'weekly',
    copy: vi.fn(async () => undefined),
    $t: ((key: string | number) => String(key)) as any,
    numberFormatter: (value: number) => String(value),
  } as unknown as TrendLineConfig

  return { ...config, ...overrides }
}

function createDataset(): TrendLineDataset {
  return {
    lines: [{ name: 'nuxt', series: [1, 2, 3] } as any],
  }
}

function createVersionsBarConfigForTests(
  overrides: Partial<VersionsBarConfig> = {},
): VersionsBarConfig {
  const { translate } = createTranslateMock()

  const base: VersionsBarConfig = {
    theme: 'dark',
    chart: {},
    copy: vi.fn(async () => undefined),
    $t: translate as any,
    numberFormatter: (value: number) => `nf:${value}`,
    datapointLabels: [],
    dateRangeLabel: 'RANGE',
    semverGroupingMode: 'major',
  } as unknown as VersionsBarConfig

  return { ...base, ...overrides }
}

function createVersionsBarDatasetForTests(
  values: Array<number | null | undefined>,
  packageName?: string,
): VersionsBarDataset {
  return {
    bars: [
      {
        name: packageName,
        series: values,
      } as any,
    ],
  }
}

describe('sum', () => {
  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0)
  })

  it('returns the same number for a single-element array', () => {
    expect(sum([42])).toBe(42)
  })

  it('sums positive numbers correctly', () => {
    expect(sum([1, 2, 3, 4, 5])).toBe(15)
  })

  it('sums negative numbers correctly', () => {
    expect(sum([-1, -2, -3])).toBe(-6)
  })

  it('sums mixed positive and negative numbers correctly', () => {
    expect(sum([10, -5, 3, -2])).toBe(6)
  })

  it('returns 0 when all values are 0', () => {
    expect(sum([0, 0, 0])).toBe(0)
  })

  it('handles decimal numbers correctly', () => {
    expect(sum([1.5, 2.5, 3])).toBeCloseTo(7, 10)
  })
})

describe('chunkIntoWeeks', () => {
  it('returns an empty array when input is empty', () => {
    expect(chunkIntoWeeks([])).toEqual([])
  })

  it('returns one full week when length equals default weekSize (7)', () => {
    const input = [1, 2, 3, 4, 5, 6, 7]
    expect(chunkIntoWeeks(input)).toEqual([[1, 2, 3, 4, 5, 6, 7]])
  })

  it('splits into multiple full weeks', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
    expect(chunkIntoWeeks(input)).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9, 10, 11, 12, 13, 14],
    ])
  })

  it('creates a final partial week if remaining items are less than weekSize', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    expect(chunkIntoWeeks(input)).toEqual([
      [1, 2, 3, 4, 5, 6, 7],
      [8, 9],
    ])
  })

  it('works with custom weekSize', () => {
    const input = [1, 2, 3, 4, 5]
    expect(chunkIntoWeeks(input, 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles weekSize larger than array length', () => {
    const input = [1, 2, 3]
    expect(chunkIntoWeeks(input, 10)).toEqual([[1, 2, 3]])
  })

  it('works with generic types (strings)', () => {
    const input = ['a', 'b', 'c', 'd']
    expect(chunkIntoWeeks(input, 3)).toEqual([['a', 'b', 'c'], ['d']])
  })

  it('works with objects', () => {
    const input = [{ id: 1 }, { id: 2 }, { id: 3 }]
    expect(chunkIntoWeeks(input, 2)).toEqual([[{ id: 1 }, { id: 2 }], [{ id: 3 }]])
  })
})

describe('buildWeeklyEvolutionFromDaily', () => {
  it('returns empty array when daily input is empty', () => {
    expect(buildWeeklyEvolutionFromDaily([])).toEqual([])
  })

  it('builds one full week correctly', () => {
    const daily = [
      { day: '2048-01-01', downloads: 10 },
      { day: '2048-01-02', downloads: 20 },
      { day: '2048-01-03', downloads: 30 },
      { day: '2048-01-04', downloads: 40 },
      { day: '2048-01-05', downloads: 50 },
      { day: '2048-01-06', downloads: 60 },
      { day: '2048-01-07', downloads: 70 },
    ]

    const result = buildWeeklyEvolutionFromDaily(daily)

    expect(result).toEqual([
      {
        weekStart: '2048-01-01',
        weekEnd: '2048-01-07',
        downloads: 280,
      },
    ])
  })

  it('builds multiple full weeks correctly', () => {
    const daily = Array.from({ length: 14 }, (_, i) => ({
      day: `2048-01-${String(i + 1).padStart(2, '0')}`,
      downloads: 10,
    }))

    const result = buildWeeklyEvolutionFromDaily(daily)

    expect(result).toEqual([
      {
        weekStart: '2048-01-01',
        weekEnd: '2048-01-07',
        downloads: 70,
      },
      {
        weekStart: '2048-01-08',
        weekEnd: '2048-01-14',
        downloads: 70,
      },
    ])
  })

  it('creates a final partial week when less than 7 days remain', () => {
    const daily = [
      { day: '2048-01-01', downloads: 10 },
      { day: '2048-01-02', downloads: 10 },
      { day: '2048-01-03', downloads: 10 },
      { day: '2048-01-04', downloads: 10 },
      { day: '2048-01-05', downloads: 10 },
      { day: '2048-01-06', downloads: 10 },
      { day: '2048-01-07', downloads: 10 },
      { day: '2048-01-08', downloads: 5 },
      { day: '2048-01-09', downloads: 5 },
    ]

    const result = buildWeeklyEvolutionFromDaily(daily)

    expect(result).toEqual([
      {
        weekStart: '2048-01-01',
        weekEnd: '2048-01-07',
        downloads: 70,
      },
      {
        weekStart: '2048-01-08',
        weekEnd: '2048-01-09',
        downloads: 10,
      },
    ])
  })

  it('handles zero downloads correctly', () => {
    const daily = [
      { day: '2048-01-01', downloads: 0 },
      { day: '2048-01-02', downloads: 0 },
      { day: '2048-01-03', downloads: 0 },
    ]

    const result = buildWeeklyEvolutionFromDaily(daily)

    expect(result).toEqual([
      {
        weekStart: '2048-01-01',
        weekEnd: '2048-01-03',
        downloads: 0,
      },
    ])
  })

  it('handles mixed download values correctly', () => {
    const daily = [
      { day: '2048-01-01', downloads: 5 },
      { day: '2048-01-02', downloads: 15 },
      { day: '2048-01-03', downloads: 20 },
    ]

    const result = buildWeeklyEvolutionFromDaily(daily)

    expect(result).toEqual([
      {
        weekStart: '2048-01-01',
        weekEnd: '2048-01-03',
        downloads: 40,
      },
    ])
  })
})

describe('clamp', () => {
  it('returns the value when it is within bounds', () => {
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('returns minValue when value is below the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
  })

  it('returns maxValue when value is above the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10)
  })

  it('returns minValue when value equals minValue', () => {
    expect(clamp(0, 0, 10)).toBe(0)
  })

  it('returns maxValue when value equals maxValue', () => {
    expect(clamp(10, 0, 10)).toBe(10)
  })

  it('works with negative bounds', () => {
    expect(clamp(-15, -10, -5)).toBe(-10)
    expect(clamp(-7, -10, -5)).toBe(-7)
    expect(clamp(-1, -10, -5)).toBe(-5)
  })

  it('works with decimal values', () => {
    expect(clamp(1.5, 0.5, 2.5)).toBe(1.5)
    expect(clamp(0.1, 0.5, 2.5)).toBe(0.5)
    expect(clamp(3.7, 0.5, 2.5)).toBe(2.5)
  })
})

describe('quantile', () => {
  it('returns 0 for an empty array', () => {
    expect(quantile([], 0.5)).toBe(0)
  })

  it('returns the first value when quantileValue <= 0', () => {
    expect(quantile([10, 20, 30], 0)).toBe(10)
    expect(quantile([10, 20, 30], -1)).toBe(10)
  })

  it('returns the last value when quantileValue >= 1', () => {
    expect(quantile([10, 20, 30], 1)).toBe(30)
    expect(quantile([10, 20, 30], 2)).toBe(30)
  })

  it('returns the median for an odd-length array (q = 0.5)', () => {
    expect(quantile([10, 20, 30], 0.5)).toBe(20)
  })

  it('returns interpolated value for even-length array (q = 0.5)', () => {
    expect(quantile([10, 20, 30, 40], 0.5)).toBe(25)
  })

  it('computes lower quartile correctly (q = 0.25)', () => {
    expect(quantile([0, 10, 20, 30], 0.25)).toBe(7.5)
  })

  it('computes upper quartile correctly (q = 0.75)', () => {
    expect(quantile([0, 10, 20, 30], 0.75)).toBe(22.5)
  })

  it('returns exact value when position is integer (no interpolation)', () => {
    expect(quantile([0, 10, 20, 30], 1 / 3)).toBe(10)
  })

  it('works with negative numbers', () => {
    expect(quantile([-30, -20, -10, 0], 0.5)).toBe(-15)
  })

  it('handles single-element arrays', () => {
    expect(quantile([42], 0)).toBe(42)
    expect(quantile([42], 0.5)).toBe(42)
    expect(quantile([42], 1)).toBe(42)
  })
})

describe('winsorize', () => {
  it('clamps low and high outliers to the computed percentile bounds (keeps original order)', () => {
    const input = [1, 2, 3, 4, 100]
    const result = winsorize(input, 0.2, 0.8)

    expect(result).toHaveLength(5)
    expect(result[0]).toBeCloseTo(1.8, 12)
    expect(result[1]).toBeCloseTo(2, 12)
    expect(result[2]).toBeCloseTo(3, 12)
    expect(result[3]).toBeCloseTo(4, 12)
    expect(result[4]).toBeCloseTo(23.2, 12)
  })

  it('keeps duplicates and clamps consistently', () => {
    const input = [0, 0, 0, 0, 10]
    const result = winsorize(input, 0.2, 0.8)

    expect(result).toHaveLength(5)
    expect(result[0]).toBeCloseTo(0, 12)
    expect(result[1]).toBeCloseTo(0, 12)
    expect(result[2]).toBeCloseTo(0, 12)
    expect(result[3]).toBeCloseTo(0, 12)
    expect(result[4]).toBeCloseTo(2, 12)
  })

  it('works with negative values', () => {
    const input = [-100, -10, 0, 10, 100]
    const result = winsorize(input, 0.2, 0.8)

    expect(result).toHaveLength(5)
    expect(result[0]).toBeCloseTo(-28, 12)
    expect(result[1]).toBeCloseTo(-10, 12)
    expect(result[2]).toBeCloseTo(0, 12)
    expect(result[3]).toBeCloseTo(10, 12)
    expect(result[4]).toBeCloseTo(28, 12)
  })
})

const computeBaseTrend = (rSquared: number | null) => {
  if (rSquared === null) return 'undefined' as const
  if (rSquared > 0.75) return 'strong' as const
  if (rSquared > 0.4) return 'weak' as const
  return 'none' as const
}

const buildSeries = (base: number, step: number, noiseAmplitude: number) => {
  const values: number[] = []
  for (let i = 0; i < 19; i += 1) {
    const noise =
      i % 4 === 0
        ? noiseAmplitude
        : i % 4 === 1
          ? -noiseAmplitude
          : i % 4 === 2
            ? Math.floor(noiseAmplitude / 2)
            : -Math.floor(noiseAmplitude / 2)
    values.push(base + i * step + noise)
  }
  return values
}

describe('computeLineChartAnalysis', () => {
  it('returns undefined interpretations for empty array', () => {
    const result = computeLineChartAnalysis([])
    expect(result.mean).toBe(0)
    expect(result.standardDeviation).toBe(0)
    expect(result.coefficientOfVariation).toBeNull()
    expect(result.slope).toBe(0)
    expect(result.rSquared).toBeNull()
    expect(result.interpretation.volatility).toBe('undefined')
    expect(result.interpretation.trend).toBe('undefined')
  })

  it('ignores null values and behaves like empty when all values are null', () => {
    const result = computeLineChartAnalysis([null, null, null])
    expect(result.mean).toBe(0)
    expect(result.standardDeviation).toBe(0)
    expect(result.coefficientOfVariation).toBeNull()
    expect(result.slope).toBe(0)
    expect(result.rSquared).toBeNull()
    expect(result.interpretation.volatility).toBe('undefined')
    expect(result.interpretation.trend).toBe('undefined')
  })

  it('handles a single number', () => {
    const result = computeLineChartAnalysis([42])
    expect(result.mean).toBe(42)
    expect(result.standardDeviation).toBe(0)
    expect(result.coefficientOfVariation).toBeNull()
    expect(result.slope).toBe(0)
    expect(result.rSquared).toBeNull()
    expect(result.interpretation.volatility).toBe('very_stable')
    expect(result.interpretation.trend).toBe('none')
  })

  it('handles a single number among nulls (keeps original index for regression)', () => {
    const result = computeLineChartAnalysis([null, 42, null])
    expect(result.mean).toBe(42)
    expect(result.standardDeviation).toBe(0)
    expect(result.coefficientOfVariation).toBeNull()
    expect(result.slope).toBe(0)
    expect(result.rSquared).toBeNull()
    expect(result.interpretation.volatility).toBe('very_stable')
    expect(result.interpretation.trend).toBe('none')
  })

  it('handles all zeros (mean 0 => CV null, sd 0, rSquared null)', () => {
    const result = computeLineChartAnalysis([0, 0, 0, 0])
    expect(result.mean).toBe(0)
    expect(result.standardDeviation).toBe(0)
    expect(result.coefficientOfVariation).toBeNull()
    expect(result.slope).toBe(0)
    expect(result.rSquared).toBeNull()
    expect(result.interpretation.volatility).toBe('undefined')
    expect(result.interpretation.trend).toBe('none')
  })

  it('handles two values where the first value is 0', () => {
    const result = computeLineChartAnalysis([0, 10])

    expect(result.mean).toBe(5)
    expect(result.standardDeviation).toBe(5)
    expect(result.coefficientOfVariation).not.toBeNull()
    expect(result.coefficientOfVariation as number).toBeCloseTo(1, 10)

    expect(result.slope).toBeGreaterThan(0)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeGreaterThanOrEqual(0)
    expect(result.rSquared as number).toBeLessThanOrEqual(1)

    expect(result.interpretation.volatility).toBe('volatile')
  })

  it('handles two values where the second value is 0', () => {
    const result = computeLineChartAnalysis([10, 0])

    expect(result.mean).toBe(5)
    expect(result.standardDeviation).toBe(5)
    expect(result.coefficientOfVariation).not.toBeNull()
    expect(result.coefficientOfVariation as number).toBeCloseTo(1, 10)

    expect(result.slope).toBeLessThan(0)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeGreaterThanOrEqual(0)
    expect(result.rSquared as number).toBeLessThanOrEqual(1)

    expect(result.interpretation.volatility).toBe('volatile')
  })

  it('produces low CV and strong trend for a near-stable upward sequence', () => {
    const result = computeLineChartAnalysis([9800, 9900, 10000, 10100, 10200])
    expect(result.mean).toBeCloseTo(10000, 10)
    expect(result.coefficientOfVariation).not.toBeNull()
    expect(result.coefficientOfVariation as number).toBeLessThan(0.05)
    expect(result.interpretation.volatility).toBe('very_stable')

    expect(result.slope).toBeGreaterThan(0)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeGreaterThan(0.99)
    expect(result.interpretation.trend).toBe('strong')
  })

  it('computes slope and rSquared correctly for perfect linear growth', () => {
    const result = computeLineChartAnalysis([10, 20, 30, 40])
    expect(result.mean).toBe(25)
    expect(result.standardDeviation).toBeGreaterThan(0)
    expect(result.slope).toBeCloseTo(10, 10)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeCloseTo(1, 10)
    expect(result.interpretation.trend).toBe('strong')
  })

  it('computes slope and rSquared correctly for perfect linear decline', () => {
    const result = computeLineChartAnalysis([40, 30, 20, 10])
    expect(result.mean).toBe(25)
    expect(result.slope).toBeCloseTo(-10, 10)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeCloseTo(1, 10)
    expect(result.interpretation.trend).toBe('strong')
  })

  it('returns rSquared null when variance is zero, even if multiple points exist', () => {
    const result = computeLineChartAnalysis([5, 5, 5])
    expect(result.mean).toBe(5)
    expect(result.standardDeviation).toBe(0)
    expect(result.rSquared).toBeNull()
    expect(result.interpretation.trend).toBe('none')
  })

  it('handles nulls within a perfect linear trend using original indexes', () => {
    const result = computeLineChartAnalysis([10, null, 30, null, 50])
    expect(result.mean).toBeCloseTo(30, 10)
    expect(result.slope).toBeCloseTo(10, 10)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeCloseTo(1, 10)
    expect(result.interpretation.trend).toBe('strong')
  })

  it('classifies volatility thresholds correctly', () => {
    const veryStable = computeLineChartAnalysis([100, 101, 99, 100, 100])
    expect(veryStable.coefficientOfVariation).not.toBeNull()
    expect(veryStable.interpretation.volatility).toBe('very_stable')

    const moderate = computeLineChartAnalysis([100, 120, 80, 110, 90])
    expect(moderate.coefficientOfVariation).not.toBeNull()
    const moderateValue = moderate.coefficientOfVariation as number
    expect(moderateValue).toBeGreaterThanOrEqual(0.1)
    expect(moderateValue).toBeLessThan(0.25)
    expect(moderate.interpretation.volatility).toBe('moderate')

    const volatile = computeLineChartAnalysis([100, 200, 0, 250, 50])
    expect(volatile.coefficientOfVariation).not.toBeNull()
    expect(volatile.interpretation.volatility).toBe('volatile')
  })

  it('stays weak when base trend is weak and relativeSlope < 0.06 (no upgrade)', () => {
    let found: number[] | null = null

    // High base & moderate step generate low relativeSlope, add noise to keep rSquared in the [0.4, 0.75] range
    for (const base of [10_000, 20_000, 50_000]) {
      for (const step of [50, 100, 150, 200, 250]) {
        for (const noiseAmplitude of [200, 300, 400, 500, 700, 900, 1200]) {
          const series = buildSeries(base, step, noiseAmplitude)
          const result = computeLineChartAnalysis(series)

          const baseTrend = computeBaseTrend(result.rSquared)
          if (baseTrend !== 'weak') continue

          const mean = series.reduce((a, b) => a + b, 0) / series.length
          const relativeSlope = mean === 0 ? 0 : Math.abs(result.slope) / mean
          if (relativeSlope >= 0.06) continue

          if (result.interpretation.trend === 'weak') {
            found = series
            break
          }
        }
        if (found) break
      }
      if (found) break
    }

    expect(found).not.toBeNull()

    const result = computeLineChartAnalysis(found as number[])
    expect(result.rSquared).not.toBeNull()
    const r2 = result.rSquared as number
    expect(r2).toBeGreaterThan(0.4)
    expect(r2).toBeLessThanOrEqual(0.75)
    expect(result.interpretation.trend).toBe('weak')
  })

  it('upgrades weak to strong when base trend is weak and relativeSlope >= 0.06', () => {
    let found: number[] | null = null

    // Lower base & larger step generate higher relativeSlope, add noise to keep rSquared in the [0.4, 0.75] range
    for (const base of [50, 100, 200, 300, 500]) {
      for (const step of [10, 12, 15, 18, 20, 25, 30]) {
        for (const noiseAmplitude of [10, 15, 20, 25, 30, 35, 40, 50]) {
          const series = buildSeries(base, step, noiseAmplitude)
          const result = computeLineChartAnalysis(series)

          const baseTrend = computeBaseTrend(result.rSquared)
          if (baseTrend !== 'weak') continue

          const mean = series.reduce((a, b) => a + b, 0) / series.length
          const relativeSlope = mean === 0 ? 0 : Math.abs(result.slope) / mean
          if (relativeSlope < 0.06) continue

          if (result.interpretation.trend === 'strong') {
            found = series
            break
          }
        }
        if (found) break
      }
      if (found) break
    }

    expect(found).not.toBeNull()
    const result = computeLineChartAnalysis(found as number[])
    expect(result.rSquared).not.toBeNull()
    const r2 = result.rSquared as number
    expect(r2).toBeGreaterThan(0.4)
    expect(r2).toBeLessThanOrEqual(0.75)
    expect(result.interpretation.trend).toBe('strong')
  })

  it('does not winsorize when there are fewer than 20 valid points', () => {
    const result = computeLineChartAnalysis([10, 20, 30, 40])
    expect(result.slope).toBeCloseTo(10, 10)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeCloseTo(1, 10)
    expect(result.interpretation.trend).toBe('strong')
  })

  it('winsorizes when there are at least 20 valid points', () => {
    const values: Array<number | null> = Array.from({ length: 19 }, (_, i) => i * 10)
    values.push(1_000_000)

    const result = computeLineChartAnalysis(values)

    expect(result.slope).toBeGreaterThan(0)
    expect(result.rSquared).not.toBeNull()
    expect(result.rSquared as number).toBeGreaterThanOrEqual(0)
    expect(result.rSquared as number).toBeLessThanOrEqual(1)
  })

  it('upgrades trend from none to weak when relativeSlope is high enough', () => {
    // Many points, huge growth + noise to keep linearity low but direction strong.
    const values: Array<number | null> = []
    for (let i = 0; i < 25; i += 1) {
      values.push(i * 1000 + (i % 2 === 0 ? 0 : 8000))
    }

    const result = computeLineChartAnalysis(values)

    expect(result.slope).toBeGreaterThan(0)
    expect(result.rSquared).not.toBeNull()
    expect(result.interpretation.trend === 'weak' || result.interpretation.trend === 'strong').toBe(
      true,
    )
  })

  it('classifies trend thresholds correctly', () => {
    const strong = computeLineChartAnalysis([10, 20, 30, 40, 50])
    expect(strong.rSquared).not.toBeNull()
    expect(strong.interpretation.trend).toBe('strong')

    const undefinedTrend = computeLineChartAnalysis([0, 0, 0, 0])
    expect(undefinedTrend.rSquared).toBeNull()
    expect(undefinedTrend.interpretation.trend).toBe('none')
  })
})

describe('createAltTextForTrendLineChart', () => {
  it('handles dataset with empty lines without throwing', () => {
    const { translate } = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({ $t: translate })

    expect(() =>
      createAltTextForTrendLineChart({
        dataset: { lines: [] },
        config: trendLineConfig,
      } as AltCopyArgs<TrendLineDataset, TrendLineConfig>),
    ).not.toThrow()
  })

  it('returns empty string when dataset is null', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({ $t: translateMock.translate })

    const result = createAltTextForTrendLineChart({
      dataset: null,
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    expect(result).toBe('')
    expect(translateMock.calls).toHaveLength(0)
  })

  it('uses single-package prefix when there is one line', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({ $t: translateMock.translate })

    const result = createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([10, 20, 30, 40]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    expect(result.startsWith('t:package.trends.copy_alt.single_package')).toBe(true)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.copy_alt.single_package')
    expect(keys).toContain('package.trends.copy_alt.general_description')
    expect(keys).toContain('package.trends.copy_alt.analysis')
  })

  it('uses compare prefix when there are multiple lines', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({ $t: translateMock.translate })

    const result = createAltTextForTrendLineChart({
      dataset: createDatasetWithTwoLines([10, 20, 30, 40], [40, 30, 20, 10]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    expect(result.startsWith('t:package.trends.copy_alt.compare')).toBe(true)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.copy_alt.compare')
    expect(keys).toContain('package.trends.copy_alt.general_description')
    expect(keys).toContain('package.trends.copy_alt.analysis')
  })

  it('translates granularity through the static map for weekly', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      granularity: 'weekly',
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([10, 20, 30, 40]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.granularity_weekly')
  })

  it('falls back to weekly granularity key when granularity is not in the map', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      granularity: 'day' as unknown as TrendLineConfig['granularity'],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([10, 20, 30, 40]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.granularity_weekly')
  })

  it('includes estimation notice when hasEstimation is true', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      hasEstimation: true,
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([10, 20, 30, 40]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.copy_alt.estimation')
  })

  it('uses plural estimation key when hasEstimation is true and multiple lines exist', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      hasEstimation: true,
      formattedDatasetValues: [
        ['1', '2'],
        ['3', '4'],
      ],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithTwoLines([10, 20, 30, 40], [40, 30, 20, 10]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.copy_alt.estimations')
  })

  it('uses the correct trend translation key for a strong trend', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      formattedDatasetValues: [['10', '40']],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([10, 20, 30, 40]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.copy_alt.trend_strong')
  })

  it('uses the correct trend translation key for undefined trend (flat series)', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      formattedDatasetValues: [['5', '5']],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([5, 5, 5, 5]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const keys = translateMock.calls.map(call => call.key)
    expect(keys).toContain('package.trends.copy_alt.trend_none')
  })

  it('passes expected named parameters into analysis translation', () => {
    const translateMock = createTranslateMock()
    const numberFormatter = vi.fn((value: number) => `formatted:${value}`)

    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      numberFormatter,
      formattedDatasetValues: [['100', '200']],
      formattedDates: [
        { text: '2026-03-01', absoluteIndex: 0 },
        { text: '2026-03-10', absoluteIndex: 9 },
      ],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([100, 120, 140, 160, 180, 200]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const analysisCall = translateMock.calls.find(
      call => call.key === 'package.trends.copy_alt.analysis',
    )
    expect(analysisCall).toBeTruthy()

    const named = analysisCall?.named ?? {}
    expect(named).toHaveProperty('package_name', 'nuxt')
    expect(named).toHaveProperty('start_value', '100')
    expect(named).toHaveProperty('end_value', '200')
    expect(named).toHaveProperty('trend')
    expect(named).toHaveProperty('downloads_slope')

    expect(numberFormatter).toHaveBeenCalledTimes(1)
    expect(String(named.downloads_slope)).toMatch(/^formatted:/)
  })

  it('uses "-" fallback for missing formatted dates in general_description named parameters', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      formattedDates: [],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithSingleLine([10, 20, 30, 40]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const generalDescriptionCall = translateMock.calls.find(
      call => call.key === 'package.trends.copy_alt.general_description',
    )
    expect(generalDescriptionCall).toBeTruthy()

    const named = generalDescriptionCall?.named ?? {}
    expect(named).toHaveProperty('start_date', '-')
    expect(named).toHaveProperty('end_date', '-')
  })

  it('passes watermark, granularity, and packages_analysis into general_description', () => {
    const translateMock = createTranslateMock()
    const trendLineConfig = createTrendLineConfig({
      $t: translateMock.translate,
      granularity: 'weekly',
      formattedDatasetValues: [
        ['10', '40'],
        ['40', '10'],
      ],
    })

    createAltTextForTrendLineChart({
      dataset: createDatasetWithTwoLines([10, 20, 30, 40], [40, 30, 20, 10]),
      config: trendLineConfig,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    const generalDescriptionCall = translateMock.calls.find(
      call => call.key === 'package.trends.copy_alt.general_description',
    )
    expect(generalDescriptionCall).toBeTruthy()

    const named = generalDescriptionCall?.named ?? {}
    expect(named).toHaveProperty('granularity')
    expect(named).toHaveProperty('packages_analysis')
    expect(named).toHaveProperty('watermark')
  })
})

describe('copyAltTextForTrendLineChart', () => {
  it('forwards createAltTextForTrendLineChart result to config.copy', async () => {
    const copyMock = vi.fn(async () => undefined)
    const config = createConfig({
      copy: copyMock,
      $t: ((key: string | number) => `t:${String(key)}`) as any,
      formattedDates: [{ text: '2026-03-01', absoluteIndex: 0 }],
      formattedDatasetValues: [['1', '2', '3']],
      numberFormatter: (value: number) => `nf:${value}`,
      granularity: 'weekly',
    })

    const dataset = createDataset()

    const expected = createAltTextForTrendLineChart({
      dataset,
      config,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    await copyAltTextForTrendLineChart({
      dataset,
      config,
    } as AltCopyArgs<TrendLineDataset, TrendLineConfig>)

    expect(copyMock).toHaveBeenCalledTimes(1)
    expect(copyMock).toHaveBeenCalledWith(expected)
  })
})

describe('createAltTextForVersionsBarChart', () => {
  it('handles dataset with empty bars without throwing', () => {
    const { translate } = createTranslateMock()
    const config = createVersionsBarConfigForTests({ $t: translate as any })

    expect(() =>
      createAltTextForVersionsBarChart({
        dataset: { bars: [] },
        config,
      } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>),
    ).not.toThrow()
  })

  it('returns empty string when dataset is null (does not translate)', () => {
    const { translate, calls } = createTranslateMock()
    const config = createVersionsBarConfigForTests({ $t: translate as any })

    const result = createAltTextForVersionsBarChart({
      dataset: null,
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    expect(result).toBe('')
    expect(calls).toHaveLength(0)
  })

  it('calls general_description with expected named params (major grouping)', () => {
    const { translate, calls } = createTranslateMock()

    const config = createVersionsBarConfigForTests({
      $t: translate as any,
      semverGroupingMode: 'major',
      dateRangeLabel: 'from 19 Feb to 25 Feb, 2026',
      datapointLabels: ['2.0.x', '3.0.x', '4.0.x'],
      numberFormatter: (value: number) => `${value}M`,
    })

    const dataset = createVersionsBarDatasetForTests([10, 20, 30], 'nuxt')

    const result = createAltTextForVersionsBarChart({
      dataset,
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    expect(result).toBe('t:package.versions.copy_alt.general_description')

    const keys = calls.map(c => c.key)
    expect(keys).toContain('package.versions.grouping_major')
    expect(keys).toContain('package.trends.copy_alt.watermark')
    expect(keys).toContain('package.versions.copy_alt.general_description')

    const generalCall = calls.find(c => c.key === 'package.versions.copy_alt.general_description')
    expect(generalCall).toBeTruthy()

    expect(generalCall?.named).toMatchObject({
      package_name: 'nuxt',
      versions_count: 3,
      first_version: '2.0.x',
      last_version: '4.0.x',
      date_range_label: 'from 19 Feb to 25 Feb, 2026',
      max_downloaded_version: '4.0.x',
      max_version_downloads: '30M',
    })

    expect(generalCall?.named).toHaveProperty(
      'semver_grouping_mode',
      't:package.versions.grouping_major',
    )
    expect(generalCall?.named).toHaveProperty('watermark', 't:package.trends.copy_alt.watermark')
  })

  it('uses grouping_minor when semverGroupingMode is not "major"', () => {
    const { translate, calls } = createTranslateMock()

    const config = createVersionsBarConfigForTests({
      $t: translate as any,
      semverGroupingMode: 'minor',
    })

    createAltTextForVersionsBarChart({
      dataset: createVersionsBarDatasetForTests([1, 2], 'pkg'),
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    const keys = calls.map(c => c.key)
    expect(keys).toContain('package.versions.grouping_minor')
  })

  it('builds per_version_analysis in reverse order and excludes the max version', () => {
    const { translate, calls } = createTranslateMock()

    const config = createVersionsBarConfigForTests({
      $t: translate as any,
      datapointLabels: ['v1', 'v2', 'v3', 'v4'],
      numberFormatter: (value: number) => `${value}M`,
    })

    createAltTextForVersionsBarChart({
      dataset: createVersionsBarDatasetForTests([10, 20, 999, 40], 'pkg'),
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    const perVersionCalls = calls.filter(
      c => c.key === 'package.versions.copy_alt.per_version_analysis',
    )
    expect(perVersionCalls).toHaveLength(3)

    expect(perVersionCalls[0]?.named).toMatchObject({ version: 'v4', downloads: '40M' })
    expect(perVersionCalls[1]?.named).toMatchObject({ version: 'v2', downloads: '20M' })
    expect(perVersionCalls[2]?.named).toMatchObject({ version: 'v1', downloads: '10M' })

    const generalCall = calls.find(c => c.key === 'package.versions.copy_alt.general_description')
    expect(generalCall).toBeTruthy()

    expect(generalCall?.named).toHaveProperty(
      'per_version_analysis',
      Array.from({ length: 3 }, () => 't:package.versions.copy_alt.per_version_analysis').join(
        ', ',
      ),
    )
  })

  it('treats null/undefined series values as 0 for max selection and formatting', () => {
    const { translate, calls } = createTranslateMock()

    const config = createVersionsBarConfigForTests({
      $t: translate as any,
      datapointLabels: ['v1', 'v2', 'v3'],
      numberFormatter: (value: number) => `${value}M`,
    })

    createAltTextForVersionsBarChart({
      dataset: createVersionsBarDatasetForTests([null, 5, undefined], 'pkg'),
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    const generalCall = calls.find(c => c.key === 'package.versions.copy_alt.general_description')
    expect(generalCall?.named).toMatchObject({
      max_downloaded_version: 'v2',
      max_version_downloads: '5M',
    })
  })
})

describe('copyAltTextForVersionsBarChart', () => {
  it('forwards createAltTextForVersionsBarChart result to config.copy', async () => {
    const copyMock = vi.fn(async () => undefined)

    const config = createVersionsBarConfigForTests({
      copy: copyMock,
      $t: ((key: string | number) => `t:${String(key)}`) as any,
      numberFormatter: (value: number) => `${value}M`,
      datapointLabels: ['v1', 'v2', 'v3'],
      dateRangeLabel: 'RANGE',
      semverGroupingMode: 'major',
    })

    const dataset = createVersionsBarDatasetForTests([1, 2, 3], 'pkg')

    const expected = createAltTextForVersionsBarChart({
      dataset,
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    await copyAltTextForVersionsBarChart({
      dataset,
      config,
    } as AltCopyArgs<VersionsBarDataset, VersionsBarConfig>)

    expect(copyMock).toHaveBeenCalledTimes(1)
    expect(copyMock).toHaveBeenCalledWith(expected)
  })
})

describe('loadFile', () => {
  let createElementMock: ReturnType<typeof vi.fn>
  let clickMock: ReturnType<typeof vi.fn>
  let removeMock: ReturnType<typeof vi.fn>
  let originalDocument: typeof globalThis.document | undefined

  beforeEach(() => {
    clickMock = vi.fn()
    removeMock = vi.fn()

    createElementMock = vi.fn().mockReturnValue({
      href: '',
      download: '',
      click: clickMock,
      remove: removeMock,
    })

    originalDocument = globalThis.document

    Object.defineProperty(globalThis, 'document', {
      value: {
        createElement: createElementMock,
      },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()

    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
      writable: true,
    })
  })

  it('creates an anchor element and triggers a download', () => {
    const link = 'https://npmx.dev/file.png'
    const filename = 'file.png'
    loadFile(link, filename)
    expect(createElementMock).toHaveBeenCalledWith('a')
    const anchor = createElementMock.mock.results[0]?.value as HTMLAnchorElement
    expect(anchor.href).toBe(link)
    expect(anchor.download).toBe(filename)
    expect(clickMock).toHaveBeenCalledTimes(1)
    expect(removeMock).toHaveBeenCalledTimes(1)
  })
})

describe('sanitise', () => {
  it('returns the same string when no sanitisation is needed', () => {
    expect(sanitise('nuxt-package')).toBe('nuxt-package')
  })

  it('removes a leading @ character', () => {
    expect(sanitise('@nuxt/ui')).toBe('nuxt-ui')
  })

  it('removes only the first leading @ character', () => {
    expect(sanitise('@@scope/package')).toBe('@scope-package')
  })

  it('replaces forward slashes with dashes', () => {
    expect(sanitise('scope/package/name')).toBe('scope-package-name')
  })

  it('replaces backslashes with dashes', () => {
    expect(sanitise('scope\\package\\name')).toBe('scope-package-name')
  })

  it('replaces colon characters with dashes', () => {
    expect(sanitise('name:with:colons')).toBe('name-with-colons')
  })

  it('replaces invalid filename characters with dashes', () => {
    expect(sanitise('na<me>:"with"*?pipes|')).toBe('na-me---with---pipes-')
  })

  it('handles scoped package names correctly', () => {
    expect(sanitise('@scope/package')).toBe('scope-package')
  })

  it('replaces mixed invalid characters in a single string', () => {
    expect(sanitise('@scope/package:name*test?value<foo>|bar')).toBe(
      'scope-package-name-test-value-foo--bar',
    )
  })

  it('returns an empty string when given an empty string', () => {
    expect(sanitise('')).toBe('')
  })
})

describe('insertLineBreaks', () => {
  it('returns an empty string when text is not a string', () => {
    expect(insertLineBreaks(null as unknown as string)).toBe('')
    expect(insertLineBreaks(undefined as unknown as string)).toBe('')
    expect(insertLineBreaks(42 as unknown as string)).toBe('')
    expect(insertLineBreaks({} as unknown as string)).toBe('')
  })

  it('returns the original text when maxCharactersPerLine is not a positive integer', () => {
    expect(insertLineBreaks('hello world', 0)).toBe('hello world')
    expect(insertLineBreaks('hello world', -1)).toBe('hello world')
    expect(insertLineBreaks('hello world', 2.5)).toBe('hello world')
    expect(insertLineBreaks('hello world', Number.NaN)).toBe('hello world')
  })

  it('returns the same text when it already fits on one line', () => {
    expect(insertLineBreaks('hello world', 24)).toBe('hello world')
  })

  it('breaks text into multiple lines on word boundaries', () => {
    expect(insertLineBreaks('hello world again', 11)).toBe('hello world\nagain')
  })

  it('preserves a single space between words when collapsing whitespace', () => {
    expect(insertLineBreaks('hello     world', 24)).toBe('hello world')
  })

  it('ignores leading and trailing whitespace', () => {
    expect(insertLineBreaks('   hello world   ', 24)).toBe('hello world')
  })

  it('handles tabs and newlines as whitespace separators', () => {
    expect(insertLineBreaks('hello\tworld\nagain', 11)).toBe('hello world\nagain')
  })

  it('starts a new line when adding a word would exceed the limit', () => {
    expect(insertLineBreaks('one two three', 7)).toBe('one two\nthree')
  })

  it('keeps a word on the current line when it exactly matches the limit', () => {
    expect(insertLineBreaks('abc def', 7)).toBe('abc def')
  })

  it('splits a long token into chunks when it exceeds the limit', () => {
    expect(insertLineBreaks('abcdefghijkl', 5)).toBe('abcde\nfghij\nkl')
  })

  it('pushes the current line before splitting a long token', () => {
    expect(insertLineBreaks('hello abcdefghij', 5)).toBe('hello\nabcde\nfghij')
  })

  it('continues building lines after a split long token', () => {
    expect(insertLineBreaks('abcdefghij klm nop', 5)).toBe('abcde\nfghij\nklm\nnop')
  })

  it('handles multiple consecutive long tokens', () => {
    expect(insertLineBreaks('abcdefghijk lmnopqrs', 4)).toBe('abcd\nefgh\nijk\nlmno\npqrs')
  })

  it('returns an empty string for an empty input string', () => {
    expect(insertLineBreaks('', 24)).toBe('')
  })

  it('returns an empty string for a whitespace-only string', () => {
    expect(insertLineBreaks('     ', 24)).toBe('')
    expect(insertLineBreaks('\n\t  ', 24)).toBe('')
  })

  it('uses the default maxCharactersPerLine value when omitted', () => {
    expect(insertLineBreaks('one two three four five six')).toBe('one two three four five\nsix')
  })
})

describe('applyEllipsis', () => {
  it('returns an empty string when text is not a string', () => {
    expect(applyEllipsis(null as unknown as string)).toBe('')
    expect(applyEllipsis(undefined as unknown as string)).toBe('')
    expect(applyEllipsis(42 as unknown as string)).toBe('')
    expect(applyEllipsis({} as unknown as string)).toBe('')
  })

  it('returns the original text when maxLength is not a positive integer', () => {
    expect(applyEllipsis('touching grass', 0)).toBe('touching grass')
    expect(applyEllipsis('touching grass', -1)).toBe('touching grass')
    expect(applyEllipsis('touching grass', 2.5)).toBe('touching grass')
    expect(applyEllipsis('touching grass', Number.NaN)).toBe('touching grass')
  })

  it('returns the original text when its length is less than maxLength', () => {
    expect(applyEllipsis('grass', 10)).toBe('grass')
  })

  it('returns the original text when its length is equal to maxLength', () => {
    expect(applyEllipsis('grass', 5)).toBe('grass')
  })

  it('truncates the text and appends an ellipsis when its length exceeds maxLength', () => {
    expect(applyEllipsis('grass touching', 5)).toBe('grass...')
  })

  it('uses the default maxLength when omitted', () => {
    const text = 'n'.repeat(46)
    expect(applyEllipsis(text)).toBe(`${'n'.repeat(45)}...`)
  })

  it('returns an empty string for an empty input string', () => {
    expect(applyEllipsis('')).toBe('')
  })

  it('handles maxLength equal to 1', () => {
    expect(applyEllipsis('grass', 1)).toBe('g...')
  })

  it('preserves whitespace within the truncated portion', () => {
    expect(applyEllipsis('you need to touch grass', 13)).toBe('you need to t...')
  })
})

describe('createSeedNumber', () => {
  it('returns the same hash for the same input', () => {
    expect(createSeedNumber('react')).toBe(createSeedNumber('react'))
    expect(createSeedNumber('vue')).toBe(createSeedNumber('vue'))
  })

  it('returns different hashes for different inputs', () => {
    expect(createSeedNumber('react')).not.toBe(createSeedNumber('vue'))
    expect(createSeedNumber('svelte')).not.toBe(createSeedNumber('solid'))
  })

  it('returns a 32 bit unsigned integer', () => {
    const result = createSeedNumber('react')
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(4294967295)
  })

  it('handles an empty string', () => {
    const result = createSeedNumber('')
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(4294967295)
  })

  it('is case sensitive', () => {
    expect(createSeedNumber('react')).not.toBe(createSeedNumber('React'))
  })
})

describe('createSeededSvgPattern', () => {
  it('returns deterministic output for the same seed', () => {
    const first = createSeededSvgPattern('react')
    const second = createSeededSvgPattern('react')
    expect(first).toEqual(second)
  })

  it('returns different output for different seeds', () => {
    const first = createSeededSvgPattern('react')
    const second = createSeededSvgPattern('vue')
    expect(second).not.toEqual(first)
  })

  it('returns a valid pattern object shape', () => {
    const result = createSeededSvgPattern('react')
    expect(typeof result.width).toBe('number')
    expect(typeof result.height).toBe('number')
    expect(typeof result.rotation).toBe('number')
    expect(typeof result.patternType).toBe('string')
    expect(typeof result.contentMarkup).toBe('string')
  })

  it('uses default options when none are provided', () => {
    const result = createSeededSvgPattern('react')
    expect(result.width).toBeGreaterThanOrEqual(8)
    expect(result.width).toBeLessThanOrEqual(20)
    expect(result.height).toBe(result.width)
    expect(result.contentMarkup.length).toBeGreaterThan(0)
  })

  it('uses the provided foreground and background colors', () => {
    const result = createSeededSvgPattern('react', {
      foregroundColor: '#ff0000',
      backgroundColor: '#00ff00',
    })
    expect(result.contentMarkup).toContain('#ff0000')
    expect(result.contentMarkup).toContain('#00ff00')
    expect(result.contentMarkup).toContain('<rect x="0" y="0"')
  })

  it('does not inject a background rect when backgroundColor is transparent', () => {
    const result = createSeededSvgPattern('react', {
      backgroundColor: 'transparent',
    })
    expect(result.contentMarkup).not.toContain('<rect x="0" y="0"')
  })

  it('respects the provided size range', () => {
    const result = createSeededSvgPattern('react', {
      minimumSize: 10,
      maximumSize: 16,
    })
    expect(result.width).toBeGreaterThanOrEqual(10)
    expect(result.width).toBeLessThanOrEqual(16)
    expect(result.height).toBe(result.width)
  })

  it('always returns one of the supported pattern types', () => {
    const allowedPatternTypes = [
      'diagonalLines',
      'verticalLines',
      'horizontalLines',
      'crosshatch',
      'dots',
      'grid',
      'zigzag',
    ]
    const result = createSeededSvgPattern('react')
    expect(allowedPatternTypes).toContain(result.patternType)
  })

  it('returns a supported rotation value', () => {
    const allowedRotations = [0, 15, 30, 45, 60, 75, 90, 120, 135]
    const result = createSeededSvgPattern('react')
    expect(allowedRotations).toContain(result.rotation)
  })

  it('returns svg markup matching the selected pattern type', () => {
    const seeds = [
      'react',
      'vue',
      'svelte',
      'solid',
      'angular',
      'ember',
      'preact',
      'lit',
      'alpine',
      'nuxt',
      'next',
      'astro',
      'qwik',
      'backbone',
    ]

    const expectedTagByPatternType: Record<
      ReturnType<typeof createSeededSvgPattern>['patternType'],
      string
    > = {
      diagonalLines: '<line',
      verticalLines: '<line',
      horizontalLines: '<line',
      crosshatch: '<line',
      dots: '<circle',
      grid: '<line',
      zigzag: '<path',
    }

    for (const seed of seeds) {
      const result = createSeededSvgPattern(seed)
      const expectedTag = expectedTagByPatternType[result.patternType]
      expect(result.contentMarkup).toContain(expectedTag)
    }
  })

  it('accepts numeric seeds', () => {
    const result = createSeededSvgPattern(12345)
    expect(typeof result.width).toBe('number')
    expect(typeof result.contentMarkup).toBe('string')
    expect(result.contentMarkup.length).toBeGreaterThan(0)
  })

  it('returns deterministic output for equivalent numeric and string seeds', () => {
    const numericSeedResult = createSeededSvgPattern(12345)
    const stringSeedResult = createSeededSvgPattern('12345')
    expect(numericSeedResult).toEqual(stringSeedResult)
  })
})

describe('createChartPatternSlotMarkup', () => {
  it('returns a pattern element with the provided id', () => {
    const result = createChartPatternSlotMarkup({
      id: 'pattern-1',
      seed: 7,
      color: '#ff0000',
      foregroundColor: '#ffffff',
      fallbackColor: 'transparent',
      maxSize: 24,
      minSize: 16,
    })

    expect(result).toContain('<pattern')
    expect(result).toContain('id="pattern-1"')
    expect(result).toContain('patternUnits="userSpaceOnUse"')
    expect(result).toContain('</pattern>')
  })

  it('includes width, height, rotation, and content markup from the generated pattern', () => {
    const generatedPattern = createSeededSvgPattern(1, {
      foregroundColor: '#000',
      backgroundColor: 'transparent',
      minimumSize: 16,
      maximumSize: 24,
    })

    const result = createChartPatternSlotMarkup({
      id: 'pattern-1',
      seed: 1,
      foregroundColor: '#000',
      fallbackColor: 'transparent',
      maxSize: 24,
      minSize: 16,
    })

    expect(result).toContain(`width="${generatedPattern.width}"`)
    expect(result).toContain(`height="${generatedPattern.height}"`)
    expect(result).toContain(`patternTransform="rotate(${generatedPattern.rotation})"`)
    expect(result).toContain(generatedPattern.contentMarkup)
  })

  it('is deterministic for the same inputs', () => {
    const first = createChartPatternSlotMarkup({
      id: 'pattern-stable',
      seed: 'nuxt',
      color: '#00ff00',
      foregroundColor: '#000000',
      fallbackColor: 'transparent',
      maxSize: 40,
      minSize: 10,
    })

    const second = createChartPatternSlotMarkup({
      id: 'pattern-stable',
      seed: 'nuxt',
      color: '#00ff00',
      foregroundColor: '#000000',
      fallbackColor: 'transparent',
      maxSize: 40,
      minSize: 10,
    })

    expect(first).toBe(second)
  })

  it('changes when the id changes', () => {
    const first = createChartPatternSlotMarkup({
      id: 'pattern-a',
      seed: 1,
      color: '#00ff00',
      foregroundColor: '#000000',
      fallbackColor: 'transparent',
      maxSize: 40,
      minSize: 10,
    })

    const second = createChartPatternSlotMarkup({
      id: 'pattern-b',
      seed: 2,
      color: '#00ff00',
      foregroundColor: '#000000',
      fallbackColor: 'transparent',
      maxSize: 40,
      minSize: 10,
    })

    expect(first).not.toBe(second)
  })
})
