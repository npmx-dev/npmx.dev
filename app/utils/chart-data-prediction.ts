import type { ChartTimeGranularity } from '~/types/chart'
import { applyDataCorrection, type ChartFilterSettings } from '~/utils/chart-data-correction'

export const DEFAULT_PREDICTION_POINTS = 4

// ---------------------------------------------------------------------------
// Bucket boundaries (UTC)
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000

function getUtcDayStart(ts: number): number {
  const d = new Date(ts)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// Monday-based week start in UTC
function getWeeklyBucketStartUtc(ts: number): number {
  const dayStart = getUtcDayStart(ts)
  const day = new Date(dayStart).getUTCDay()
  const diffFromMonday = (day + 6) % 7
  return dayStart - diffFromMonday * DAY_MS
}

function clampRatio(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** Convert `YYYY-MM-DD` to UTC ms at end-of-day (`23:59:59.999`). */
export function endDateOnlyToUtcMs(d: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return null
  return Date.UTC(y, m - 1, day, 23, 59, 59, 999)
}

/** Start of the bucket containing `ts` (inclusive). */
export function getBucketStartUtc(ts: number, g: ChartTimeGranularity): number {
  const d = new Date(ts)
  if (g === 'yearly') return Date.UTC(d.getUTCFullYear(), 0, 1)
  if (g === 'monthly') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)
  if (g === 'weekly') return getWeeklyBucketStartUtc(ts)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** End of the bucket containing `ts` (exclusive). */
export function getBucketEndUtc(ts: number, g: ChartTimeGranularity): number {
  const d = new Date(ts)
  if (g === 'yearly') return Date.UTC(d.getUTCFullYear() + 1, 0, 1)
  if (g === 'monthly') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)
  if (g === 'weekly') return getWeeklyBucketStartUtc(ts) + 7 * DAY_MS
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)
}

/** How much of the bucket has elapsed at `refMs` — value in `[0, 1]`. */
export function getCompletionRatio(bucketTs: number, g: ChartTimeGranularity, refMs: number) {
  const start = getBucketStartUtc(bucketTs, g)
  const total = getBucketEndUtc(bucketTs, g) - start
  return total <= 0 ? 1 : clampRatio((refMs - start) / total)
}

// ---------------------------------------------------------------------------
// Linear regression
// ---------------------------------------------------------------------------

/** Project the next value via least-squares on `pts` (min 2). Returns `null` on failure. */
export function linearProject(pts: number[]): number | null {
  const n = pts.length
  if (n < 2) return null

  let sx = 0,
    sy = 0,
    sxy = 0,
    sxx = 0
  for (let i = 0; i < n; i++) {
    sx += i
    sy += pts[i]!
    sxy += i * pts[i]!
    sxx += i * i
  }
  const det = n * sxx - sx * sx
  if (det === 0) return null

  const slope = (n * sxy - sx * sy) / det
  const intercept = (sy - slope * sx) / n
  const v = slope * n + intercept
  return Number.isFinite(v) ? Math.max(0, v) : null
}

// ---------------------------------------------------------------------------
// Extrapolation
// ---------------------------------------------------------------------------

/**
 * Estimate the full-period value for a partially-complete last bucket.
 *
 * Uses linear projection when enough complete lookback points are available
 * (`>= predictionPoints`), otherwise falls back to proportional scale-up.
 * Returns the raw last value when the period is already complete or prediction is disabled.
 */
export function extrapolateLastValue(params: {
  series: number[]
  granularity: ChartTimeGranularity
  lastDateMs: number
  referenceMs: number
  predictionPoints: number
}): number {
  const { series, granularity, lastDateMs, referenceMs, predictionPoints } = params
  const last = series.at(-1) ?? 0

  const bucketTs = lastDateMs
  const ratio = getCompletionRatio(bucketTs, granularity, referenceMs)

  if (!(ratio > 0 && ratio < 1) || predictionPoints <= 0) return last

  const lookback = series.slice(0, -1).slice(-predictionPoints)

  if (lookback.length >= predictionPoints) {
    const projected = linearProject(lookback)
    if (projected !== null) return projected
  }

  const scaled = last / ratio
  return Number.isFinite(scaled) ? scaled : last
}

// ---------------------------------------------------------------------------
// Pipeline: prediction → data correction
// ---------------------------------------------------------------------------

export interface DataPipelineSettings extends ChartFilterSettings {
  predictionPoints: number
}

export interface DataPipelineContext {
  granularity: ChartTimeGranularity
  lastDateMs: number
  referenceMs: number
  /** True for absolute metrics (e.g. contributors) that need no extrapolation. */
  isAbsoluteMetric: boolean
}

/**
 * Full data-tweak pipeline for a single series:
 * 1. Prediction – replace last partial value with extrapolated estimate
 * 2. Data correction – smoothing & averaging
 */
export function applyDataPipeline(
  series: number[],
  settings: DataPipelineSettings,
  ctx: DataPipelineContext,
): number[] {
  if (series.length === 0) return series

  // Step 1: prediction
  let s = series
  if (!ctx.isAbsoluteMetric) {
    const projected = extrapolateLastValue({
      series,
      granularity: ctx.granularity,
      lastDateMs: ctx.lastDateMs,
      referenceMs: ctx.referenceMs,
      predictionPoints: settings.predictionPoints,
    })
    s = [...series.slice(0, -1), projected]
  }

  // Step 2: smoothing & averaging
  return applyDataCorrection(
    s.map(value => ({ value })),
    settings,
  ).map(d => d.value)
}
