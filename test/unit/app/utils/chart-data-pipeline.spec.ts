import { describe, expect, it } from 'vitest'
import { applyDataPipeline } from '~/utils/chart-data-prediction'
import { applyDataCorrection } from '~/utils/chart-data-correction'

const settings = { averageWindow: 2, smoothingTau: 3, predictionPoints: 0 }
const context = {
  granularity: 'daily' as const,
  lastDateMs: Date.UTC(2026, 9, 19),
  referenceMs: Date.UTC(2026, 9, 19, 12),
  isAbsoluteMetric: false,
}

describe('gap aware data pipeline', () => {
  it.each([
    [null, 100, 200, 100, null, null, 1000, 2000, 1000, null],
    [100, null, 1000],
    [null, null],
    [],
  ])('preserves gaps for %j', (...series) => {
    const result = applyDataPipeline(series, settings, context)
    const expected = series.slice()
    expect(result.map(value => value === null)).toEqual(series.map(value => value === null))
    expect(series).toEqual(expected)
  })

  it('smooths each run without contamination from missing values', () => {
    const run = [100, 300, 200, 400]
    const corrected = applyDataCorrection(
      run.map(value => ({ value })),
      settings,
    ).map(p => p.value)
    expect(applyDataPipeline([...run, null, 9000], settings, context)).toEqual([
      ...corrected,
      null,
      9000,
    ])
  })

  it('preserves gaps with filters disabled and keeps genuine zeros', () => {
    const series = [10, 0, null, 20, null]
    expect(
      applyDataPipeline(series, { ...settings, averageWindow: 0, smoothingTau: 0 }, context),
    ).toEqual(series)
  })

  it('does not predict a missing final bucket', () => {
    expect(
      applyDataPipeline([100, 200, null], { ...settings, predictionPoints: 2 }, context),
    ).toEqual([100, 200, null])
  })

  it('uses only the final continuous run for prediction', () => {
    expect(
      applyDataPipeline([100, 200, null, 50], { ...settings, predictionPoints: 2 }, context),
    ).toEqual([100, 200, null, 100])
  })
})
