import { createError } from 'h3'
import { createStaticVueUiXy } from 'vue-data-ui/ssr/vue-ui-xy'
import { mergeConfigs } from 'vue-data-ui/utils'
import { generateWatermarkLogo } from '#shared/utils/trends-chart'
import {
  buildNormalisedTrendsDataset,
  buildTrendsChartConfig,
  buildTrendsChartData,
} from '#shared/utils/trends-chart'
import { resolveEmbedChartColors } from '#shared/utils/embed-chart-colors'
import { OKLCH_NEUTRAL_FALLBACK } from '~/utils/colors'
import { getEffectiveEndDateIso, isLastDayOfMonth, isLastDayOfYear } from '~/utils/date'
import { fetchDownloadsEvolution } from '~~/server/utils/download-evolution'

type FetchGranularity = 'day' | 'week' | 'month' | 'year'
type ChartGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
type Metric = 'downloads' | 'likes' | 'contributors'
type QueryParameters = Record<string, unknown>

export function parsePackageNames(value: unknown): string[] {
  return String(value ?? '')
    .split(',')
    .map(name => name.trim().toLowerCase())
    .filter(name => /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(name))
    .slice(0, 8)
}

export function parseFetchGranularity(value: unknown): FetchGranularity {
  if (value === 'daily' || value === 'day') return 'day'
  if (value === 'weekly' || value === 'week') return 'week'
  if (value === 'monthly' || value === 'month') return 'month'
  if (value === 'yearly' || value === 'year') return 'year'
  return 'week'
}

export function toChartGranularity(granularity: FetchGranularity): ChartGranularity {
  const mapping: Record<FetchGranularity, ChartGranularity> = {
    day: 'daily',
    week: 'weekly',
    month: 'monthly',
    year: 'yearly',
  }

  return mapping[granularity]
}

export function parseLocale(value: unknown): string {
  if (typeof value !== 'string') return 'en'

  try {
    return Intl.getCanonicalLocales(value.trim())[0] ?? 'en'
  } catch {
    return 'en'
  }
}

export function parseAccent(value: unknown): string {
  if (typeof value !== 'string') {
    return OKLCH_NEUTRAL_FALLBACK
  }

  const accent = value.trim()

  if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(accent)) {
    return accent
  }

  if (
    /^oklch\(\s*(?:0|1|0?\.\d+|\d{1,3}(?:\.\d+)?%)\s+(?:0|0?\.\d+|\d+(?:\.\d+)?)\s+(?:\d+(?:\.\d+)?|none)(?:deg|rad|grad|turn)?(?:\s*\/\s*(?:0|1|0?\.\d+|\d{1,3}(?:\.\d+)?%))?\s*\)$/i.test(
      accent,
    )
  ) {
    return accent
  }

  return OKLCH_NEUTRAL_FALLBACK
}

export function parseSafeText(value: unknown, fallback = '', maximumLength = 100): string {
  if (typeof value !== 'string') return fallback

  return (
    value
      .replace(/[<>&"'`]/g, '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\u{0000}-\u{001F}\u{007F}]/gu, '')
      .trim()
      .slice(0, maximumLength)
  )
}

export function parseDateQuery(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined

  const date = value.trim()

  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined
}

export function clampNumber(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
): number {
  const parsed = Number(value)

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, parsed))
}

export function parseMetric(value: unknown): Metric {
  if (value === 'likes') return 'likes'
  if (value === 'contributors') return 'contributors'

  return 'downloads'
}

export async function createDownloadsSvgResponse(query: QueryParameters): Promise<string> {
  const packageNames = parsePackageNames(query.packages ?? query.package)

  if (!packageNames.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing package name. Use ?package=nuxt or ?packages=vite,rolldown',
    })
  }

  const fetchGranularity = parseFetchGranularity(query.granularity)
  const chartGranularity = toChartGranularity(fetchGranularity)
  const metric = parseMetric(query.metric)
  const isDarkMode = query.mode === 'dark'
  const width = clampNumber(query.width, 360, 1600, 900)
  const height = clampNumber(query.height, 240, 900, 420)

  const locale = parseLocale(query.locale)
  const accent = parseAccent(query.accent)
  const yLabel = parseSafeText(query.yLabel, '', 100)

  const evolutionOptions = {
    granularity: fetchGranularity,
    weeks: clampNumber(query.weeks, 1, 260, 52),
    months: clampNumber(query.months, 1, 120, 12),
    startDate: parseDateQuery(query.startDate ?? query.start),
    endDate: parseDateQuery(query.endDate ?? query.end),
  }

  if (metric !== 'downloads') {
    throw createError({
      statusCode: 501,
      statusMessage: 'Only the downloads metric is currently supported by the SVG endpoint',
    })
  }

  const evolutionsByPackage = Object.fromEntries(
    await Promise.all(
      packageNames.map(async packageName => [
        packageName,
        await fetchDownloadsEvolution(packageName, evolutionOptions),
      ]),
    ),
  )

  const colors = resolveEmbedChartColors(isDarkMode ? 'dark' : 'light')
  const compactNumberFormatter = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  })

  const chartFilter = {
    averageWindow: 1,
    smoothingTau: 0,
    predictionPoints: 0,
  }

  const chartData = buildTrendsChartData({
    packageNames,
    effectivePackageNamesForMetric: packageNames,
    isMultiPackageMode: packageNames.length > 1,
    selectedMetric: metric,
    selectedMetricLabel: '',
    selectedGranularity: chartGranularity,
    displayedGranularity: chartGranularity,
    singleEvolution: evolutionsByPackage[packageNames[0]!] ?? [],
    evolutionsByPackage,
    colors,
    isDarkMode,
    chartFilter,
    t: ((key: string) => key) as any,
    compactNumberFormatter,
    accent,
  })

  const dataset = buildNormalisedTrendsDataset({
    dataset: chartData.dataset,
    dates: chartData.dates,
    granularity: chartGranularity,
    selectedMetric: metric,
    chartFilter,
    nowMs: Date.now(),
  })

  if (!chartData.dataset?.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No chart dataset generated',
    })
  }

  if (!dataset.length) {
    throw createError({
      statusCode: 404,
      statusMessage: 'No normalized dataset generated',
    })
  }

  const baseConfig = buildTrendsChartConfig({
    packageNames,
    effectivePackageNamesForMetric: packageNames,
    isMultiPackageMode: packageNames.length > 1,
    selectedMetric: metric,
    selectedMetricLabel: '',
    selectedGranularity: chartGranularity,
    displayedGranularity: chartGranularity,
    singleEvolution: evolutionsByPackage[packageNames[0]!] ?? [],
    evolutionsByPackage,
    dates: chartData.dates,
    colors,
    isDarkMode,
    isMobile: false,
    pending: false,
    locale,
    chartHeight: height,
    chartFilter,
    t: ((key: string) => key) as any,
    compactNumberFormatter,
    tooltipPosition: 'center',
  })

  const config = mergeConfigs({
    defaultConfig: baseConfig,
    userConfig: {
      line: {
        useGradient: false,
        area: {
          opacity: 12,
        },
      },
      chart: {
        width,
        height,
        padding: {
          left: 12,
          right: 120,
        },
        legend: {
          show: true,
          position: 'top',
          fontSize: 24,
          color: colors.fgMuted,
        },
        grid: {
          labels: {
            fontSize: 12,
            axis: {
              fontSize: 16,
              yLabel,
            },
            yAxis: {
              scaleLabelOffsetX: 0,
              crosshairSize: 6,
            },
            xAxisLabels: {
              fontSize: 12,
              color: colors.fgMuted,
            },
          },
        },
      },
    },
  })

  const effectiveEndDateIso = getEffectiveEndDateIso(evolutionOptions.endDate)

  const shouldDashLastPoint =
    (chartGranularity === 'monthly' && !isLastDayOfMonth(effectiveEndDateIso)) ||
    (chartGranularity === 'yearly' && !isLastDayOfYear(effectiveEndDateIso))

  return await createStaticVueUiXy({
    dataset: dataset.map(datapoint => {
      const dashIndices = shouldDashLastPoint
        ? [...new Set([...(datapoint.dashIndices ?? []), datapoint.series.length - 1])].filter(
            index => index >= 0,
          )
        : datapoint.dashIndices

      return Object.assign({}, datapoint, { dashIndices })
    }),
    config,
    additionalSvgContent: ({ series, drawingArea }) => {
      const lastPlotValues = series
        .map(serie => {
          const lastPlot = (serie.plots || []).at(-1)

          if (!lastPlot) return ''

          return `
              <text
                  x="${lastPlot.x + 8}"
                  y="${lastPlot.y}"
                  fill="${colors.fg}"
                  stroke="${colors.bg}"
                  stroke-width="1"
                  paint-order="stroke fill"
                  font-size="18"
                  dominant-baseline="middle"
                  text-anchor="start"
              >
                  ${compactNumberFormatter.format(Number(lastPlot.value ?? 0))}
              </text>
          `
        })
        .join('')

      const logo = generateWatermarkLogo({
        x: 12,
        y: drawingArea.bottom + 60,
        width: 80,
        height: 30,
        fill: colors.fgSubtle,
      })

      return `
          ${lastPlotValues}
          ${logo}
        `
    },
  })
}
