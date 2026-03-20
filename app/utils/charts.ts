import type {
  AltCopyArgs,
  VueUiHorizontalBarConfig,
  VueUiHorizontalBarDatapoint,
  VueUiXyConfig,
  VueUiXyDatasetBarItem,
  VueUiXyDatasetLineItem,
} from 'vue-data-ui'
import type { ChartTimeGranularity } from '~/types/chart'

export function sum(numbers: number[]): number {
  return numbers.reduce((a, b) => a + b, 0)
}

export function chunkIntoWeeks<T>(items: T[], weekSize = 7): T[][] {
  const result: T[][] = []
  for (let index = 0; index < items.length; index += weekSize) {
    result.push(items.slice(index, index + weekSize))
  }
  return result
}

export function buildWeeklyEvolutionFromDaily(
  daily: Array<{ day: string; downloads: number }>,
): Array<{ weekStart: string; weekEnd: string; downloads: number }> {
  const weeks = chunkIntoWeeks(daily, 7)
  return weeks.map(weekDays => {
    const weekStart = weekDays[0]?.day ?? ''
    const weekEnd = weekDays[weekDays.length - 1]?.day ?? ''
    const downloads = sum(weekDays.map(d => d.downloads))
    return { weekStart, weekEnd, downloads }
  })
}

// Statistics & Interpretation utilities

export function clamp(value: number, minValue: number, maxValue: number): number {
  if (value < minValue) return minValue
  if (value > maxValue) return maxValue
  return value
}

/**
 * Computes a quantile value from a sorted numeric array using linear interpolation.
 *
 * The input array must already be sorted in ascending order.
 * The function does not sort the array internally.
 *
 * Behavior:
 * - If the array is empty → returns 0
 * - If quantileValue <= 0 → returns the first element
 * - If quantileValue >= 1 → returns the last element
 * - Otherwise → returns the interpolated value between the two nearest ranks
 *
 * The quantile is computed using the "linear interpolation between closest ranks" method:
 *
 *   position = (n - 1) * q
 *
 * where:
 *   n = number of elements
 *   q = quantileValue (between 0 and 1)
 *
 * The result is interpolated between the floor and ceil positions.
 *
 * @example quantile([1, 2, 3, 4], 0.5) // 2.5
 * @param sortedValues Sorted array of numeric values (ascending order)
 * @param quantileValue Quantile to compute (typically between 0 and 1)
 * @returns The computed quantile value
 */
export function quantile(sortedValues: number[], quantileValue: number): number {
  const length = sortedValues.length

  if (length === 0) return 0

  if (quantileValue <= 0) {
    const first = sortedValues[0]
    return first === undefined ? 0 : first
  }

  if (quantileValue >= 1) {
    const last = sortedValues[length - 1]
    return last === undefined ? 0 : last
  }

  const position = (length - 1) * quantileValue
  const lowerIndex = Math.floor(position)
  const upperIndex = Math.ceil(position)
  const weight = position - lowerIndex
  const lower = sortedValues[lowerIndex]!
  const upper = sortedValues[upperIndex]!

  return lower + (upper - lower) * weight
}

/**
 * Applies winsorization to a numeric array.
 *
 * Winsorization limits extreme values by clamping them to percentile-based bounds
 * instead of removing them. Values below the lower quantile are replaced with the
 * lower quantile value, and values above the upper quantile are replaced with the
 * upper quantile value.
 *
 * This reduces the influence of outliers while preserving:
 * - The original array length
 * - The original order of elements
 *
 * Does not mutate the input array.
 *
 * @param values Array of numeric values
 * @param lowerQuantile Lower percentile boundary (between 0 and 1)
 * @param upperQuantile Upper percentile boundary (between 0 and 1)
 * @returns A new array with values clamped to the computed quantile bounds
 */
export function winsorize(
  values: number[],
  lowerQuantile: number,
  upperQuantile: number,
): number[] {
  const sorted = values.toSorted((a, b) => a - b)
  const lowerBound = quantile(sorted, lowerQuantile)
  const upperBound = quantile(sorted, upperQuantile)
  return values.map(v => clamp(v, lowerBound, upperBound))
}

export type LineChartAnalysis = {
  mean: number
  standardDeviation: number
  coefficientOfVariation: number | null
  slope: number
  rSquared: number | null
  interpretation: {
    volatility: 'very_stable' | 'moderate' | 'volatile' | 'undefined'
    trend: 'strong' | 'weak' | 'none' | 'undefined'
  }
}

/**
 * Computes descriptive statistics and trend analysis for a numeric time series.
 *
 * - Ignores null and undefined values
 * - Preserves original indexes for regression (gaps do not shift time)
 * - Computes absolute and relative volatility
 * - Fits a linear regression to estimate directional trend
 * - Applies optional winsorization (5th–95th percentile) for datasets >= 20 points
 *   to reduce outlier influence on regression
 *
 * Returned metrics:
 *
 * - mean: arithmetic mean of valid values
 * - standardDeviation: population standard deviation
 * - coefficientOfVariation: relative volatility (std / mean), or null when mean is 0
 * - slope: regression slope (change per time step)
 * - rSquared: linear fit consistency (0–1), or null when undefined
 * - interpretation:
 *     - volatility: qualitative stability classification
 *     - trend: qualitative trend classification derived from:
 *         - rSquared (linearity / consistency)
 *         - relativeSlope (|slope| normalized by typical level)
 *
 * Trend classification logic:
 * - Base classification comes from rSquared
 * - May be upgraded when directional magnitude (relativeSlope)
 *   exceeds configured thresholds
 *
 * Edge cases:
 * - Empty input: fully undefined interpretation
 * - Single value: no trend, very stable
 * - Zero variance: rSquared null
 *
 * @param values Array of numeric values (can contain null)
 * @returns LineChartAnalysis object with statistics and qualitative interpretation
 */
export function computeLineChartAnalysis(values: Array<number | null>): LineChartAnalysis {
  const indexedValues: Array<{ value: number; index: number }> = []

  for (let i = 0; i < values.length; i += 1) {
    const v = values[i]
    if (v === null || v === undefined) continue
    indexedValues.push({ value: v, index: i })
  }

  const n = indexedValues.length

  if (n === 0) {
    return {
      mean: 0,
      standardDeviation: 0,
      coefficientOfVariation: null,
      slope: 0,
      rSquared: null,
      interpretation: {
        volatility: 'undefined',
        trend: 'undefined',
      },
    }
  }

  if (n === 1) {
    const onlyValue = indexedValues[0]?.value ?? 0
    return {
      mean: onlyValue,
      standardDeviation: 0,
      coefficientOfVariation: null,
      slope: 0,
      rSquared: null,
      interpretation: {
        volatility: 'very_stable',
        trend: 'none',
      },
    }
  }

  let _sum = 0
  for (const entry of indexedValues) {
    _sum += entry.value
  }
  const mean = _sum / n

  let varianceSum = 0
  for (const entry of indexedValues) {
    const diff = entry.value - mean
    varianceSum += diff * diff
  }
  const standardDeviation = Math.sqrt(varianceSum / n)

  const coefficientOfVariation = mean === 0 ? null : standardDeviation / mean

  const originalYValues: number[] = []
  for (const entry of indexedValues) {
    originalYValues.push(entry.value)
  }

  /**
   * Apply winsorization (5th–95th percentile) only when the dataset is large enough.
   *
   * For small samples, percentile bounds can fall inside the true min/max,
   * which would artificially clamp endpoints and distort perfectly linear trends:
   *
   * - If we have enough observations (>= 20), use winsorization to reduce outlier influence
   * - If the sample is small, we keep original values to preserve exact statistical properties and
   *   avoid biasing regression results
   */
  const winsorizedYValues =
    originalYValues.length >= 20 ? winsorize(originalYValues, 0.05, 0.95) : originalYValues

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0

  for (let i = 0; i < indexedValues.length; i += 1) {
    const entry = indexedValues[i]
    const y = winsorizedYValues[i]

    if (entry === undefined || y === undefined) continue

    const x = entry.index

    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }

  const denominator = n * sumXX - sumX * sumX
  const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator

  let rSquared: number | null = null

  if (denominator !== 0) {
    const meanY = sumY / n
    const intercept = (sumY - slope * sumX) / n

    let ssTotal = 0
    let ssResidual = 0

    for (let i = 0; i < indexedValues.length; i += 1) {
      const entry = indexedValues[i]
      const y = winsorizedYValues[i]
      if (entry === undefined || y === undefined) continue
      const x = entry.index
      const diff = y - meanY
      ssTotal += diff * diff
      const predicted = slope * x + intercept
      const residual = y - predicted
      ssResidual += residual * residual
    }

    if (ssTotal !== 0) {
      rSquared = 1 - ssResidual / ssTotal
    }
  }

  let volatility: LineChartAnalysis['interpretation']['volatility'] = 'undefined'

  if (coefficientOfVariation !== null) {
    if (coefficientOfVariation < 0.1) volatility = 'very_stable'
    else if (coefficientOfVariation < 0.25) volatility = 'moderate'
    else volatility = 'volatile'
  }

  let robustMeanY = 0
  if (winsorizedYValues.length > 0) {
    robustMeanY = sum(winsorizedYValues) / winsorizedYValues.length
  }
  const relativeSlope = robustMeanY === 0 ? 0 : Math.abs(slope) / robustMeanY

  let trend: LineChartAnalysis['interpretation']['trend'] = 'undefined'

  if (standardDeviation === 0) {
    trend = 'none'
  } else if (rSquared !== null) {
    if (rSquared > 0.75) {
      trend = 'strong'
    } else if (rSquared > 0.4) {
      trend = 'weak'
    } else {
      trend = 'none'
    }

    if (trend === 'none') {
      if (relativeSlope >= 0.03) trend = 'weak'
    } else if (trend === 'weak') {
      if (relativeSlope >= 0.06) trend = 'strong'
    }
  }

  return {
    mean,

    /**
     * Standard deviation : absolute volatility
     * - expressed in the same unit as the data (e.j. number of downloads).
     * - How widely values fluctuate around the average
     * - A higher value signals data instability
     */
    standardDeviation,

    /**
     * Coefficient of variation : relative volatility
     * - expressed in %
     * - calculation: standard devialtion / mean
     * |---------------|----------------------------------------------------------|
     * | VALUE         | INTERPRETATION                                           |
     * |---------------|----------------------------------------------------------|
     * | < 0.1         | stable                                                   |
     * | 0.1 - 0.25    | moderate fluctuation                                     |
     * | > 0.25        | volatile                                                 |
     * |---------------|----------------------------------------------------------|
     */
    coefficientOfVariation,

    /**
     * Slope: by how much the data increases / decreases per unit of time
     * - expressed in the same unit as the data (e.j. number of downloads)
     * - Signals the speed of change
     */
    slope,

    /**
     * Linearity / consistency of the fitted regression
     * |---------------|----------------------------------------------------------|
     * | VALUE         | INTERPRETATION                                           |
     * |---------------|----------------------------------------------------------|
     * | close to 1    | very consistent linear pattern                           |
     * | 0.4 - 0.75    | moderate linear structure                                |
     * | close to 0    | weak / noisy linear structure                            |
     * | null          | flat or insufficient variance                            |
     * |---------------|----------------------------------------------------------|
     */
    rSquared,

    /**
     * Human readable trends interpretation from which translations can be generated
     */
    interpretation: {
      /**
       * How stable the series is compared to the mean
       * |---------------|----------------------------------------------------------|
       * | VALUE         | INTERPRETATION                                           |
       * |---------------|----------------------------------------------------------|
       * | "very_stable" | values fluctuate very little relative to the mean        |
       * | "moderate"    | noticeable variation, but still within a reasonable band |
       * | "volatile"    | inconsistent activity (swings, spikes, bursts)           |
       * | "undefined"   | uncomputable (0 mean, no data)                           |
       * |---------------|----------------------------------------------------------|
       */
      volatility,

      /**
       * Trend classification derived from:
       * - rSquared (linearity / consistency)
       * - relativeSlope (magnitude of change relative to typical level)
       *
       * A trend can be upgraded when directional strength is high,
       * even if linearity is only moderate.
       *
       * |---------------|----------------------------------------------------------|
       * | VALUE         | INTERPRETATION                                           |
       * |---------------|----------------------------------------------------------|
       * | "strong"      | clear and meaningful directional movement                |
       * | "weak"        | some directional structure exists                        |
       * | "none"        | little to no meaningful directional movement, flat       |
       * | "undefined"   | insufficient data to determine a trend                   |
       * |---------------|----------------------------------------------------------|
       */
      trend,
    },
  }
}

export type TrendLineDataset = {
  lines: VueUiXyDatasetLineItem[]
  [key: string]: unknown
} | null

export type VersionsBarDataset = {
  bars: VueUiXyDatasetBarItem[]
  [key: string]: unknown
} | null

export type TrendTranslateKey = number | 'package.trends.y_axis_label' | (string & {})

export type TrendTranslateFunction = {
  (key: TrendTranslateKey): string
  (key: TrendTranslateKey, named: Record<string, unknown>): string
  (key: TrendTranslateKey, named: Record<string, unknown>, options: Record<string, unknown>): string
}

export type TrendLineConfig = VueUiXyConfig & {
  formattedDates: Array<{ text: string; absoluteIndex: number }> // from vue-data-ui
  hasEstimation: boolean // from the TrendsChart component
  formattedDatasetValues: Array<string[]>
  granularity: ChartTimeGranularity // from the TrendsChart component
  copy: (text: string) => Promise<void>
  $t: TrendTranslateFunction
  numberFormatter: (value: number) => string
}

export type VersionsBarConfig = Omit<
  TrendLineConfig,
  'formattedDates' | 'hasEstimation' | 'formattedDatasetValues' | 'granularity'
> & { datapointLabels: string[]; dateRangeLabel: string; semverGroupingMode: string }

export type FacetBarChartConfig = VueUiHorizontalBarConfig & {
  facet: string // translated
  description: string // translated
  copy: (text: string) => Promise<void>
  $t: TrendTranslateFunction
}

// Used for TrendsChart.vue
export function createAltTextForTrendLineChart({
  dataset,
  config,
}: AltCopyArgs<TrendLineDataset, TrendLineConfig>): string {
  if (!dataset) return ''

  const analysis = dataset.lines.map(({ name, series }) => ({
    name,
    ...computeLineChartAnalysis(series),
    dates: config.formattedDates,
    hasEstimation: config.hasEstimation,
  }))

  const granularityKeyByGranularity: Record<string, string> = {
    daily: 'package.trends.granularity_daily',
    weekly: 'package.trends.granularity_weekly',
    monthly: 'package.trends.granularity_monthly',
    yearly: 'package.trends.granularity_yearly',
  }

  const granularityKey =
    granularityKeyByGranularity[config.granularity] ?? 'package.trends.granularity_weekly'

  const granularity = String(config.$t(granularityKey)).toLocaleLowerCase()

  const packages_analysis = analysis
    .map((pkg, i) => {
      const trendText = (() => {
        switch (pkg.interpretation.trend) {
          case 'none':
            return config.$t('package.trends.copy_alt.trend_none')
          case 'weak':
            return config.$t('package.trends.copy_alt.trend_weak')
          case 'strong':
            return config.$t('package.trends.copy_alt.trend_strong')
          case 'undefined':
          default:
            return config.$t('package.trends.copy_alt.trend_undefined')
        }
      })()

      return config.$t('package.trends.copy_alt.analysis', {
        package_name: pkg.name,
        start_value: config.formattedDatasetValues[i]?.[0] ?? 0,
        end_value: config.formattedDatasetValues[i]?.at(-1) ?? 0,
        trend: trendText,
        downloads_slope: config.numberFormatter(pkg.slope),
      })
    })
    .join(', ')

  const isSinglePackage = analysis.length === 1

  const estimation_notice = config.hasEstimation
    ? ` ${
        isSinglePackage
          ? config.$t('package.trends.copy_alt.estimation')
          : config.$t('package.trends.copy_alt.estimations')
      }`
    : ''

  const compareText = `${config.$t('package.trends.copy_alt.compare', {
    packages: analysis.map(a => a.name).join(', '),
  })} `

  const singlePackageText = `${config.$t('package.trends.copy_alt.single_package', {
    package: analysis?.[0]?.name ?? '',
  })} `

  const generalAnalysis = config.$t('package.trends.copy_alt.general_description', {
    start_date: analysis?.[0]?.dates[0]?.text ?? '-',
    end_date: analysis?.[0]?.dates.at(-1)?.text ?? '-',
    granularity,
    packages_analysis,
    watermark: config.$t('package.trends.copy_alt.watermark'),
    estimation_notice,
  })

  return (isSinglePackage ? singlePackageText : compareText) + generalAnalysis
}

export async function copyAltTextForTrendLineChart({
  dataset,
  config,
}: AltCopyArgs<TrendLineDataset, TrendLineConfig>) {
  const altText = createAltTextForTrendLineChart({ dataset, config })
  await config.copy(altText)
}

// Used for VersionDistribution.vue
export function createAltTextForVersionsBarChart({
  dataset,
  config,
}: AltCopyArgs<VersionsBarDataset, VersionsBarConfig>) {
  if (!dataset) return ''

  const series = dataset.bars[0]?.series ?? []
  const versions = series.map((value, index) => ({
    index,
    name: config.datapointLabels[index] ?? '-',
    rawDownloads: value ?? 0,
    downloads: config.numberFormatter(value ?? 0),
  }))

  const versionWithMaxDownloads =
    versions.length > 0
      ? versions.reduce((max, current) => (current.rawDownloads > max.rawDownloads ? current : max))
      : undefined

  const per_version_analysis = versions
    .toReversed()
    .filter(v => v.index !== versionWithMaxDownloads?.index)
    .map(v =>
      config.$t(`package.versions.copy_alt.per_version_analysis`, {
        version: v?.name ?? '-',
        downloads: v?.downloads ?? '-',
      }),
    )
    .join(', ')

  const semver_grouping_mode =
    config.semverGroupingMode === 'major'
      ? config.$t('package.versions.grouping_major')
      : config.$t('package.versions.grouping_minor')

  const altText = `${config.$t('package.versions.copy_alt.general_description', {
    package_name: dataset?.bars[0]?.name ?? '-',
    versions_count: versions?.length,
    semver_grouping_mode: semver_grouping_mode.toLocaleLowerCase(),
    first_version: versions[0]?.name ?? '-',
    last_version: versions.at(-1)?.name ?? '-',
    date_range_label: config.dateRangeLabel ?? '-',
    max_downloaded_version: versionWithMaxDownloads?.name ?? '-',
    max_version_downloads: versionWithMaxDownloads?.downloads ?? '-',
    per_version_analysis,
    watermark: config.$t('package.trends.copy_alt.watermark'),
  })}`

  return altText
}

export async function copyAltTextForVersionsBarChart({
  dataset,
  config,
}: AltCopyArgs<VersionsBarDataset, VersionsBarConfig>) {
  const altText = createAltTextForVersionsBarChart({ dataset, config })
  await config.copy(altText)
}

// Used for FacetBarChart.vue
export function createAltTextForCompareFacetBarChart({
  dataset,
  config,
}: AltCopyArgs<VueUiHorizontalBarDatapoint[], FacetBarChartConfig>) {
  if (!dataset) return ''
  const { facet, description, $t } = config

  const packages = dataset.map(d => d.name).join(', ')
  const facet_analysis = dataset
    .map(d =>
      $t('package.trends.copy_alt.facet_bar_analysis', {
        package_name: d.name,
        value: d.formattedValue,
      }),
    )
    .join(' ')

  const altText = `${config.$t('package.trends.copy_alt.facet_bar_general_description', {
    packages,
    facet,
    description,
    facet_analysis,
    watermark: config.$t('package.trends.copy_alt.watermark'),
  })}`

  return altText
}

export async function copyAltTextForCompareFacetBarChart({
  dataset,
  config,
}: AltCopyArgs<VueUiHorizontalBarDatapoint[], FacetBarChartConfig>) {
  const altText = createAltTextForCompareFacetBarChart({ dataset, config })
  await config.copy(altText)
}

// Used in chart context menu callbacks
export function loadFile(link: string, filename: string) {
  const a = document.createElement('a')
  a.href = link
  a.download = filename
  a.click()
  a.remove()
}

export function sanitise(value: string) {
  return value
    .replace(/^@/, '')
    .replace(/[\\/:"*?<>|]/g, '-')
    .replace(/\//g, '-')
}

// Create multi-line labels for long names
export function insertLineBreaks(text: string, maxCharactersPerLine = 24) {
  if (typeof text !== 'string') {
    return ''
  }

  if (!Number.isInteger(maxCharactersPerLine) || maxCharactersPerLine <= 0) {
    return text
  }

  const tokens = text.match(/\S+|\s+/g) || []
  const lines: string[] = []
  let currentLine = ''

  const pushLine = () => {
    const trimmedLine = currentLine.trim()

    if (trimmedLine.length) {
      lines.push(trimmedLine)
    }

    currentLine = ''
  }

  for (const token of tokens) {
    if (/^\s+$/.test(token)) {
      if (currentLine.length && !currentLine.endsWith(' ')) {
        currentLine += ' '
      }
      continue
    }

    if (token.length > maxCharactersPerLine) {
      pushLine()

      for (let index = 0; index < token.length; index += maxCharactersPerLine) {
        lines.push(token.slice(index, index + maxCharactersPerLine))
      }
      continue
    }

    const candidate = currentLine.length ? `${currentLine}${token}` : token

    if (candidate.length <= maxCharactersPerLine) {
      currentLine = candidate
    } else {
      pushLine()
      currentLine = token
    }
  }

  pushLine()

  return lines.join('\n')
}

export function applyEllipsis(text: string, maxLength = 45) {
  if (typeof text !== 'string') {
    return ''
  }
  if (!Number.isInteger(maxLength) || maxLength <= 0) {
    return text
  }
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength) + '...'
}

// a11y pattern generation
export type SvgPatternType =
  | 'diagonalLines'
  | 'verticalLines'
  | 'horizontalLines'
  | 'crosshatch'
  | 'dots'
  | 'grid'
  | 'zigzag'

export type SeededSvgPatternOptions = {
  foregroundColor?: string
  backgroundColor?: string
  minimumSize?: number
  maximumSize?: number
}

export type SeededSvgPatternResult = {
  width: number
  height: number
  rotation: number
  patternType: SvgPatternType
  contentMarkup: string
}

type NonEmptyReadonlyArray<T> = readonly [T, ...T[]]

/**
 * Generates a deterministic 32-bit unsigned integer hash from a string.
 *
 * This function is based on the FNV-1a hashing algorithm. It is used to
 * transform any string input into a stable numeric seed suitable for
 * deterministic pseudo-random number generation.
 *
 * The same input string will always produce the same output number.
 *
 * @param value - The input string to hash.
 * @returns A 32-bit unsigned integer hash.
 */
export function createSeedNumber(value: string): number {
  let hashValue = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hashValue ^= value.charCodeAt(index)
    hashValue = Math.imul(hashValue, 16777619)
  }
  return hashValue >>> 0
}

/**
 * Creates a deterministic pseudo-random number generator (PRNG) based on a numeric seed.
 *
 * This function implements a fast, non-cryptographic PRNG similar to Mulberry32.
 * It produces a reproducible sequence of numbers in the range [0, 1), meaning
 * the same seed will always generate the same sequence.
 *
 * The returned function maintains internal state and should be called repeatedly
 * to obtain successive pseudo-random values.
 *
 * @param seedNumber - 32 bit integer seed
 * @returns A function that returns a pseudo rand number between 0 (inclusive) and 1 (exclusive).
 *
 * @example
 * const random = createDeterministicRandomGenerator(12345)
 * const a = random() // always the same for seed 12345
 * const b = random()
 */
function createDeterministicRandomGenerator(seedNumber: number): () => number {
  // Ensure the seed is treated as an unsigned 32 bit int
  let state = seedNumber >>> 0

  return function generateRandomNumber(): number {
    // Advance internal state using a constant
    state += 0x6d2b79f5
    let intermediateValue = state

    // First mixing step:
    // - XOR with a right shifted version of itself
    // - Multiply with a derived value to further scramble bits
    intermediateValue = Math.imul(
      intermediateValue ^ (intermediateValue >>> 15),
      intermediateValue | 1,
    )

    // Second mixing step:
    // - Combine current value with another transformed version of itself
    // - Multiply again to increase entropy and spread bits
    intermediateValue ^=
      intermediateValue +
      Math.imul(intermediateValue ^ (intermediateValue >>> 7), intermediateValue | 61)

    // Final step:
    // - Final XOR with shifted value for additional scrambling
    // - Convert to unsigned 32 bit int
    // - Normalize to a float in range 0 to 1
    return ((intermediateValue ^ (intermediateValue >>> 14)) >>> 0) / 4294967296
  }
}

function pickValue<T>(values: NonEmptyReadonlyArray<T>, generateRandomNumber: () => number): T {
  const selectedIndex = Math.floor(generateRandomNumber() * values.length)
  const selectedValue = values[selectedIndex]
  if (selectedValue === undefined) {
    throw new Error('pickValue requires a non-empty array')
  }
  return selectedValue
}

function escapeSvgAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function createLineElement(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: string,
  strokeWidth: number,
  opacity: number,
): string {
  const safeStroke = escapeSvgAttribute(stroke)
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${safeStroke}" stroke-width="${strokeWidth}" opacity="${opacity}" shape-rendering="crispEdges" stroke-linecap="round" stroke-linejoin="round" />`
}

function createCircleElement(
  centerX: number,
  centerY: number,
  radius: number,
  fill: string,
  opacity: number,
): string {
  const safeFill = escapeSvgAttribute(fill)
  return `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${safeFill}" opacity="${opacity}" />`
}

function createPathElement(
  pathData: string,
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number,
): string {
  const safeFill = escapeSvgAttribute(fill)
  const safeStroke = escapeSvgAttribute(stroke)
  return `<path d="${pathData}" fill="${safeFill}" stroke="${safeStroke}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" />`
}

function toNonEmptyReadonlyArray<T>(values: readonly T[]): NonEmptyReadonlyArray<T> {
  if (values.length === 0) {
    throw new Error('Expected a non-empty array')
  }

  return values as NonEmptyReadonlyArray<T>
}

export function createSeededSvgPattern(
  seed: string | number,
  options?: SeededSvgPatternOptions,
): SeededSvgPatternResult {
  const normalizedSeed = String(seed)
  const foregroundColor = options?.foregroundColor ?? '#111111'
  const backgroundColor = options?.backgroundColor ?? 'transparent'
  const minimumSize = options?.minimumSize ?? 8
  const maximumSize = options?.maximumSize ?? 20

  if (
    !Number.isFinite(minimumSize) ||
    !Number.isFinite(maximumSize) ||
    minimumSize <= 0 ||
    maximumSize <= 0 ||
    minimumSize > maximumSize
  ) {
    throw new RangeError(
      'minimumSize and maximumSize must be finite, positive, and minimumSize must not exceed maximumSize',
    )
  }

  const seedNumber = createSeedNumber(normalizedSeed)
  const generateRandomNumber = createDeterministicRandomGenerator(seedNumber)

  const patternType = pickValue(
    [
      'diagonalLines',
      'verticalLines',
      'horizontalLines',
      'crosshatch',
      'dots',
      'grid',
      'zigzag',
    ] as const,
    generateRandomNumber,
  )

  const availableSizes: number[] = []
  for (let size = minimumSize; size <= maximumSize; size += 2) {
    availableSizes.push(size)
  }

  const tileSize = pickValue(toNonEmptyReadonlyArray(availableSizes), generateRandomNumber)
  const gap = pickValue([2, 3, 4, 5, 6] as const, generateRandomNumber)
  const strokeWidth = pickValue([1, 1.25, 1.5, 1.75, 2] as const, generateRandomNumber)
  const opacity = pickValue([0.7, 0.8, 0.9, 1] as const, generateRandomNumber)
  const rotation = pickValue([0, 15, 30, 45, 60, 75, 90, 120, 135] as const, generateRandomNumber)

  let contentMarkup = ''

  switch (patternType) {
    case 'diagonalLines': {
      contentMarkup = [
        createLineElement(
          -tileSize,
          tileSize,
          tileSize,
          -tileSize,
          foregroundColor,
          strokeWidth,
          opacity,
        ),
        createLineElement(0, tileSize, tileSize, 0, foregroundColor, strokeWidth, opacity),
        createLineElement(0, tileSize * 2, tileSize * 2, 0, foregroundColor, strokeWidth, opacity),
      ].join('')
      break
    }

    case 'verticalLines': {
      const positions = [0, gap + strokeWidth, (gap + strokeWidth) * 2]
      contentMarkup = positions
        .map(x => createLineElement(x, 0, x, tileSize, foregroundColor, strokeWidth, opacity))
        .join('')
      break
    }

    case 'horizontalLines': {
      const positions = [0, gap + strokeWidth, (gap + strokeWidth) * 2]
      contentMarkup = positions
        .map(y => createLineElement(0, y, tileSize, y, foregroundColor, strokeWidth, opacity))
        .join('')
      break
    }

    case 'crosshatch': {
      contentMarkup = [
        createLineElement(
          0,
          tileSize / 2,
          tileSize,
          tileSize / 2,
          foregroundColor,
          strokeWidth,
          opacity,
        ),
        createLineElement(
          tileSize / 2,
          0,
          tileSize / 2,
          tileSize,
          foregroundColor,
          strokeWidth,
          opacity,
        ),
        createLineElement(0, 0, tileSize, tileSize, foregroundColor, strokeWidth * 0.75, opacity),
        createLineElement(tileSize, 0, 0, tileSize, foregroundColor, strokeWidth * 0.75, opacity),
      ].join('')
      break
    }

    case 'dots': {
      const radius = Math.max(1, tileSize / 12)
      contentMarkup = [
        createCircleElement(tileSize / 4, tileSize / 4, radius, foregroundColor, opacity),
        createCircleElement((tileSize * 3) / 4, tileSize / 4, radius, foregroundColor, opacity),
        createCircleElement(tileSize / 4, (tileSize * 3) / 4, radius, foregroundColor, opacity),
        createCircleElement(
          (tileSize * 3) / 4,
          (tileSize * 3) / 4,
          radius,
          foregroundColor,
          opacity,
        ),
      ].join('')
      break
    }

    case 'grid': {
      contentMarkup = [
        createLineElement(0, 0, tileSize, 0, foregroundColor, strokeWidth, opacity),
        createLineElement(0, 0, 0, tileSize, foregroundColor, strokeWidth, opacity),
        createLineElement(
          0,
          tileSize / 2,
          tileSize,
          tileSize / 2,
          foregroundColor,
          strokeWidth * 0.8,
          opacity,
        ),
        createLineElement(
          tileSize / 2,
          0,
          tileSize / 2,
          tileSize,
          foregroundColor,
          strokeWidth * 0.8,
          opacity,
        ),
      ].join('')
      break
    }

    case 'zigzag': {
      const midPoint = tileSize / 2
      const pathData = `M 0 ${midPoint} L ${tileSize / 4} 0 L ${tileSize / 2} ${midPoint} L ${(tileSize * 3) / 4} ${tileSize} L ${tileSize} ${midPoint}`
      contentMarkup = createPathElement(pathData, 'none', foregroundColor, strokeWidth, opacity)
      break
    }
  }

  if (backgroundColor !== 'transparent') {
    const safeBackgroundColor = escapeSvgAttribute(backgroundColor)
    contentMarkup = `<rect x="0" y="0" width="${tileSize}" height="${tileSize}" fill="${safeBackgroundColor}" />${contentMarkup}`
  }

  return {
    width: tileSize,
    height: tileSize,
    rotation,
    patternType,
    contentMarkup,
  }
}

export type ChartPatternSlotProps = {
  id: string
  seed: string | number
  color?: string
  foregroundColor: string
  fallbackColor: string
  maxSize: number
  minSize: number
}

// Equivalent of the PatternSlot.vue component, to be used inside tooltip.customFormat in chart configs
export function createChartPatternSlotMarkup({
  id,
  seed,
  color,
  foregroundColor,
  fallbackColor,
  maxSize,
  minSize,
}: ChartPatternSlotProps) {
  const pattern = createSeededSvgPattern(seed, {
    foregroundColor,
    backgroundColor: color ?? fallbackColor,
    minimumSize: minSize,
    maximumSize: maxSize,
  })

  return `
    <pattern
      id="${id}"
      patternUnits="userSpaceOnUse"
      width="${pattern.width}"
      height="${pattern.height}"
      patternTransform="rotate(${pattern.rotation})"
    >
      ${pattern.contentMarkup}
    </pattern>
  `
}