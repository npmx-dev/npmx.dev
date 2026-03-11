import type { EvolutionData } from '~/types/chart'

/**
 * Hampel filter for automatic anomaly detection and correction.
 *
 * For each data point, computes the median and Median Absolute Deviation (MAD)
 * of a surrounding window. Points deviating more than `threshold` MADs from
 * the local median are flagged as anomalies and replaced with the median.
 *
 * This approach is unbiased — it applies the same statistical test to every
 * package equally, with no manual curation.
 */

const DEFAULT_HALF_WINDOW = 3
const DEFAULT_THRESHOLD = 3

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function mad(values: number[], med: number): number {
  const deviations = values.map(v => Math.abs(v - med))
  return median(deviations)
}

export function applyHampelCorrection(
  data: EvolutionData,
  opts?: { halfWindow?: number; threshold?: number },
): EvolutionData {
  // halfWindow controls how many neighbors on each side to consider.
  // A window of 3 means we look at 7 points total (3 left + current + 3 right).
  const halfWindow = opts?.halfWindow ?? DEFAULT_HALF_WINDOW

  // threshold controls sensitivity. A value of 3 means a point must deviate
  // more than 3 scaled MADs from the local median to be flagged.
  // Higher = less sensitive, lower = more aggressive filtering.
  const threshold = opts?.threshold ?? DEFAULT_THRESHOLD

  // Not enough data to form a full window — return as-is.
  if (data.length < halfWindow * 2 + 1) return data

  const values = (data as Array<{ value: number }>).map(d => d.value)
  // Clone to avoid mutating the original data.
  const result = (data as Array<Record<string, any>>).map(d => ({ ...d }))

  // Only evaluate points that have a full symmetric window.
  // Boundary points lack enough context on one side, making them
  // prone to false positives (e.g., a "great start" at the end of a series).
  for (let i = halfWindow; i < values.length - halfWindow; i++) {
    const start = i - halfWindow
    const end = i + halfWindow
    const window = values.slice(start, end + 1)

    // The median is robust to outliers — unlike the mean, a single spike
    // won't pull it away from the true central tendency.
    const windowMedian = median(window)

    // MAD (Median Absolute Deviation) measures spread without being
    // influenced by the outliers we're trying to detect.
    const windowMad = mad(window, windowMedian)

    // How far this point is from the local median.
    const deviation = Math.abs(values[i]! - windowMedian)

    // MAD of 0 means most values in the window are identical.
    // We can't use the standard MAD-based score here, so fall back to a
    // relative check: only flag if the deviation is large relative to the
    // median. When the median is 0, there's no baseline to measure against
    // so we skip — this avoids erasing real low-volume activity like
    // [0,0,0,1,0,0,0].
    if (windowMad === 0) {
      if (windowMedian > 0 && deviation > windowMedian * threshold) {
        result[i]!.value = Math.round(windowMedian)
        result[i]!.hasAnomaly = true
      }
      continue
    }

    // Scale MAD to approximate standard deviation using the consistency
    // constant 1.4826 (valid for normally distributed data).
    // The resulting score is essentially "how many standard deviations
    // away from the local median is this point?"
    const score = deviation / (windowMad * 1.4826)

    // If the score exceeds the threshold, replace with the median.
    // This corrects the spike while preserving the surrounding trend.
    if (score > threshold) {
      result[i]!.value = Math.round(windowMedian)
      result[i]!.hasAnomaly = true
    }
  }

  return result as EvolutionData
}
