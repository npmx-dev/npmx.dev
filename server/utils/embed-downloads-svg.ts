import { createError } from 'h3'
import { createStaticVueUiXy } from 'vue-data-ui/ssr/vue-ui-xy'
import { mergeConfigs } from 'vue-data-ui/utils'
import {
  generateWatermarkLogo,
  LOCALES_WITH_EXTRA_SPACE,
  nullifyZeroValues,
  buildNormalisedTrendsDataset,
  buildTrendsChartConfig,
  buildTrendsChartData,
  isMissingDownloadValue,
  isLargeDownloadSeries,
} from '#shared/utils/trends-chart'
import { resolveEmbedChartColors } from '#shared/utils/embed-chart-colors'
import { OKLCH_NEUTRAL_FALLBACK } from '~/utils/colors'
import { getEffectiveEndDateIso, isLastDayOfMonth, isLastDayOfYear } from '~/utils/date'
import { fetchDownloadsEvolution } from '~~/server/utils/download-evolution'
import { createLastDatapointLabelsSvg } from '#shared/utils/download-chart-last-label'

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

function dateIsoToUtcMs(dateIso: string): number {
  return new Date(`${dateIso}T00:00:00.000Z`).getTime()
}

type RenderedPlot = {
  x?: number
  y?: number
  value?: number | null
}

type RenderedSeries = {
  color?: string
  name?: string
  plots?: RenderedPlot[]
  [key: string]: unknown
}

type NoDataTailGeometry = {
  seriesIndex: number
  x1: number
  x2: number
  y: number
  value: number
  color: string
}

function getNoDataTailGeometries({
  series,
  isLargePackageByIndex,
  fallbackColor,
}: {
  series: RenderedSeries[]
  isLargePackageByIndex: boolean[]
  fallbackColor: string
}): NoDataTailGeometry[] {
  return series.flatMap((serie, seriesIndex) => {
    if (!isLargePackageByIndex[seriesIndex]) return []

    const plots = Array.isArray(serie.plots) ? serie.plots : []
    if (plots.length < 2) return []

    const endpointPlot = plots.at(-1)
    if (!endpointPlot || !isMissingDownloadValue(endpointPlot.value)) return []

    const x2 = Number(endpointPlot.x)
    if (!Number.isFinite(x2)) return []

    let lastValidPlot: RenderedPlot | undefined
    for (let index = plots.length - 2; index >= 0; index -= 1) {
      const plot = plots[index]
      if (!plot || isMissingDownloadValue(plot.value)) continue

      const value = Number(plot.value)
      const x = Number(plot.x)
      const y = Number(plot.y)
      if (!Number.isFinite(value) || !Number.isFinite(x) || !Number.isFinite(y)) continue

      lastValidPlot = plot
      break
    }

    if (!lastValidPlot) return []

    const x1 = Number(lastValidPlot.x)
    const y = Number(lastValidPlot.y)
    const value = Number(lastValidPlot.value)
    if (!Number.isFinite(x1) || !Number.isFinite(y) || !Number.isFinite(value)) return []

    return [
      {
        seriesIndex,
        x1,
        x2,
        y,
        value,
        color: String(serie.color ?? fallbackColor),
      },
    ]
  })
}

function createNoDataTailSvg({
  geometries,
  backgroundColor,
}: {
  geometries: NoDataTailGeometry[]
  backgroundColor: string
}): string {
  return geometries
    .map(
      geometry => `
        <line
          x1="${geometry.x1}"
          y1="${geometry.y}"
          x2="${geometry.x2}"
          y2="${geometry.y}"
          stroke="${geometry.color}"
          stroke-width="3"
          stroke-dasharray="4 8"
          stroke-linecap="round"
        />
        <circle
          cx="${geometry.x2}"
          cy="${geometry.y}"
          r="4"
          fill="${geometry.color}"
          stroke="${backgroundColor}"
          stroke-width="2"
        />
      `,
    )
    .join('\n')
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
    averageWindow: 0,
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

  const effectiveEndDateIso = getEffectiveEndDateIso(evolutionOptions.endDate)
  const effectiveEndDateMs = dateIsoToUtcMs(effectiveEndDateIso)

  const dataset = buildNormalisedTrendsDataset({
    dataset: chartData.dataset,
    dates: chartData.dates,
    granularity: chartGranularity,
    selectedMetric: metric,
    chartFilter,
    endDateMs: effectiveEndDateMs,
  })

  const isLargePackageByIndex = (chartData.dataset ?? []).map(datapoint =>
    isLargeDownloadSeries(
      (datapoint.series ?? []) as Array<number | null | undefined>,
      chartGranularity,
    ),
  )

  dataset.forEach((item, index) => {
    item.series = nullifyZeroValues({
      enabled: isLargePackageByIndex[index] === true,
      values: item.series,
      keepLastZero: false,
    }) as number[]

    const rawLastValue = chartData.dataset?.[index]?.series?.at(-1)
    if (!item.series.length || !isMissingDownloadValue(rawLastValue)) return

    if (!isLargePackageByIndex[index]) {
      const series = item.series as Array<number | null>
      series[series.length - 1] = 0
    }
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
          right:
            packageNames.length > 1 ? (LOCALES_WITH_EXTRA_SPACE.includes(locale) ? 180 : 160) : 145,
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

  const shouldDashLastPoint =
    (chartGranularity === 'monthly' && !isLastDayOfMonth(effectiveEndDateIso)) ||
    (chartGranularity === 'yearly' && !isLastDayOfYear(effectiveEndDateIso))

  return await createStaticVueUiXy({
    dataset: dataset.map((datapoint, index) => {
      const rawLastValue = chartData.dataset?.[index]?.series?.at(-1)
      const hasNoDataTail =
        isLargePackageByIndex[index] === true && isMissingDownloadValue(rawLastValue)

      const dashIndices =
        shouldDashLastPoint && !hasNoDataTail
          ? [...new Set([...(datapoint.dashIndices ?? []), datapoint.series.length - 1])].filter(
              dashIndex => dashIndex >= 0,
            )
          : datapoint.dashIndices

      return Object.assign({}, datapoint, { dashIndices })
    }),
    config,
    additionalSvgContent: ({ series, drawingArea }) => {
      const renderedSeries = series as RenderedSeries[]
      const noDataGeometries = getNoDataTailGeometries({
        series: renderedSeries,
        isLargePackageByIndex,
        fallbackColor: colors.fg,
      })

      const noDataTail = createNoDataTailSvg({
        geometries: noDataGeometries,
        backgroundColor: colors.bg,
      })

      // Keep all end labels in one helper call so they share the same collision
      // resolution and connector/elbow layout. Missing endpoints display the
      // previous valid recorded value with an asterisk.
      const labelSeries = renderedSeries.slice()
      const missingEndpointLabels = new Map<number, string>()

      for (const geometry of noDataGeometries) {
        const serie = renderedSeries[geometry.seriesIndex]
        if (!serie || !Array.isArray(serie.plots) || !serie.plots.length) continue

        const plots = serie.plots.slice()
        const endpointIndex = plots.length - 1
        const endpointPlot = plots[endpointIndex]
        if (!endpointPlot) continue

        const labelValueSentinel = Number.MIN_SAFE_INTEGER + geometry.seriesIndex
        missingEndpointLabels.set(
          labelValueSentinel,
          `${compactNumberFormatter.format(geometry.value)}*`,
        )

        const labelEndpointPlot = Object.assign({}, endpointPlot)
        labelEndpointPlot.x = geometry.x2
        labelEndpointPlot.y = geometry.y
        labelEndpointPlot.value = labelValueSentinel
        plots[endpointIndex] = labelEndpointPlot

        const labelSerie = Object.assign({}, serie)
        labelSerie.plots = plots
        labelSeries[geometry.seriesIndex] = labelSerie
      }

      const lastPlotValues = createLastDatapointLabelsSvg({
        series: labelSeries,
        drawingArea,
        colors: {
          foreground: colors.fg,
          background: colors.bg,
          fallbackSerieColor: colors.fg,
        },
        formatValue: value =>
          missingEndpointLabels.get(value) ?? compactNumberFormatter.format(value),
        isDarkMode,
      })

      const lastRecordedValueLegend =
        chartGranularity === 'daily'
          ? `
            <text
              x="${drawingArea.right + 130}"
              y="${drawingArea.bottom + 82}"
              fill="${colors.fgSubtle}"
              font-size="16"
              text-anchor="end"
            >
              * Last recorded value
            </text>
          `
          : ''

      const logo = generateWatermarkLogo({
        x: 12,
        y: drawingArea.bottom + 60,
        width: 80,
        height: 30,
        fill: colors.fgSubtle,
      })

      return `
          <style>text {font-family:monospace;}</style>
          ${noDataTail}
          ${lastRecordedValueLegend}
          ${lastPlotValues}
          ${logo}
        `
    },
  })
}
