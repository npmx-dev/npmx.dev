// Shared utilies for client & embed versions of the downloads trend chart

import type { TextAlign, Theme as VueDataUiTheme } from 'vue-data-ui'
import type { VueUiXyConfig, VueUiXyDatasetItem } from 'vue-data-ui/vue-ui-xy'
import { OKLCH_NEUTRAL_FALLBACK, lightenOklch } from '~/utils/colors'
import { getFrameworkColor, isListedFramework } from '~/utils/frameworks'
import { applyEllipsis } from '~/utils/charts'
import { applyDataPipeline, DEFAULT_PREDICTION_POINTS } from '~/utils/chart-data-prediction'
import type {
  ChartTimeGranularity,
  DailyDataPoint,
  EvolutionData,
  MonthlyDataPoint,
  WeeklyDataPoint,
  YearlyDataPoint,
} from '~/types/chart'

type TrendMetricId = 'downloads' | 'likes' | 'contributors'

type TrendColors = Record<string, string>

type TrendFormatter = {
  format: (value: number) => string
}

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

type TrendChartBaseOptions = {
  packageNames: string[]
  isMultiPackageMode: boolean
  selectedMetric: TrendMetricId
  selectedMetricLabel: string
  selectedGranularity: ChartTimeGranularity
  displayedGranularity: ChartTimeGranularity
  singleEvolution: EvolutionData
  evolutionsByPackage?: Record<string, EvolutionData>
  effectivePackageNamesForMetric?: string[]
  colors: TrendColors
  accent?: string
  isDarkMode: boolean
  chartFilter: {
    averageWindow: number
    smoothingTau: number
    predictionPoints?: number
  }
  useAnomalyCorrection?: boolean
  applyAnomalyCorrection?: (params: {
    data: EvolutionData
    packageName: string
    granularity: ChartTimeGranularity
  }) => EvolutionData
  t: TranslateFn
  compactNumberFormatter: Intl.NumberFormat
}

type TrendChartDataOptions = TrendChartBaseOptions

type TrendChartConfigOptions = TrendChartBaseOptions & {
  dates: number[]
  isMobile: boolean
  pending: boolean
  locale: string
  chartHeight: number
  inModal?: boolean
  tooltipPosition?: string
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isWeeklyDataset(data: unknown): data is WeeklyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'weekStart' in data[0] &&
    'weekEnd' in data[0] &&
    'value' in data[0]
  )
}

export function isDailyDataset(data: unknown): data is DailyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'day' in data[0] &&
    'value' in data[0]
  )
}

export function isMonthlyDataset(data: unknown): data is MonthlyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'month' in data[0] &&
    'value' in data[0]
  )
}

export function isYearlyDataset(data: unknown): data is YearlyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'year' in data[0] &&
    'value' in data[0]
  )
}

function extractSeriesPoints(
  granularity: ChartTimeGranularity,
  dataset: EvolutionData,
): Array<{ timestamp: number; value: number; hasAnomaly: boolean }> {
  if (granularity === 'weekly' && isWeeklyDataset(dataset)) {
    return dataset.map(item => ({
      timestamp: item.timestampEnd,
      value: item.value,
      hasAnomaly: !!item.hasAnomaly,
    }))
  }

  if (
    (granularity === 'daily' && isDailyDataset(dataset)) ||
    (granularity === 'monthly' && isMonthlyDataset(dataset)) ||
    (granularity === 'yearly' && isYearlyDataset(dataset))
  ) {
    return (dataset as Array<{ timestamp: number; value: number; hasAnomaly?: boolean }>).map(
      item => ({
        timestamp: item.timestamp,
        value: item.value,
        hasAnomaly: !!item.hasAnomaly,
      }),
    )
  }

  return []
}

function formatSingleXyDataset(options: {
  granularity: ChartTimeGranularity
  dataset: EvolutionData
  seriesName: string
  accent: string
  isDarkMode: boolean
}): { dataset: VueUiXyDatasetItem[] | null; dates: number[] } {
  const lightColor = options.isDarkMode ? lightenOklch(options.accent, 0.618) : undefined
  const temperatureColors = lightColor ? [lightColor, options.accent] : undefined

  const datasetItem: VueUiXyDatasetItem = {
    name: applyEllipsis(options.seriesName, 32),
    type: 'line',
    series: options.dataset.map(item => item.value),
    color: options.accent,
    temperatureColors,
    useArea: true,
    dashIndices: options.dataset
      .map((item, index) => (item.hasAnomaly ? index : -1))
      .filter(index => index !== -1),
  }

  if (options.granularity === 'weekly' && isWeeklyDataset(options.dataset)) {
    return {
      dataset: [datasetItem],
      dates: options.dataset.map(item => item.timestampEnd),
    }
  }

  if (options.granularity === 'daily' && isDailyDataset(options.dataset)) {
    return {
      dataset: [datasetItem],
      dates: options.dataset.map(item => item.timestamp),
    }
  }

  if (options.granularity === 'monthly' && isMonthlyDataset(options.dataset)) {
    return {
      dataset: [datasetItem],
      dates: options.dataset.map(item => item.timestamp),
    }
  }

  if (options.granularity === 'yearly' && isYearlyDataset(options.dataset)) {
    return {
      dataset: [datasetItem],
      dates: options.dataset.map(item => item.timestamp),
    }
  }

  return { dataset: null, dates: [] }
}

export function buildTrendsChartData(options: TrendChartDataOptions): {
  dataset: VueUiXyDatasetItem[] | null
  dates: number[]
} {
  const accent = options.accent ?? options.colors.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK

  if (!options.isMultiPackageMode) {
    const packageName = options.packageNames[0] ?? ''
    return formatSingleXyDataset({
      granularity: options.displayedGranularity,
      dataset: options.singleEvolution,
      seriesName: packageName,
      accent,
      isDarkMode: options.isDarkMode,
    })
  }

  const names = options.effectivePackageNamesForMetric ?? options.packageNames
  const timestampSet = new Set<number>()
  const pointsByPackage = new Map<
    string,
    Array<{ timestamp: number; value: number; hasAnomaly?: boolean }>
  >()

  for (const packageName of names) {
    let data = options.evolutionsByPackage?.[packageName] ?? []

    if (
      options.selectedMetric === 'downloads' &&
      options.useAnomalyCorrection &&
      options.applyAnomalyCorrection
    ) {
      data = options.applyAnomalyCorrection({
        data,
        packageName,
        granularity: options.displayedGranularity,
      })
    }

    const points = extractSeriesPoints(options.displayedGranularity, data)
    pointsByPackage.set(packageName, points)

    for (const point of points) {
      timestampSet.add(point.timestamp)
    }
  }

  const dates = Array.from(timestampSet).sort((a, b) => a - b)

  if (!dates.length) {
    return { dataset: null, dates: [] }
  }

  const dataset = names.map(packageName => {
    const points = pointsByPackage.get(packageName) ?? []
    const valueByTimestamp = new Map<number, number>()
    const anomalyTimestamps = new Set<number>()

    for (const point of points) {
      valueByTimestamp.set(point.timestamp, point.value)

      if (point.hasAnomaly) {
        anomalyTimestamps.add(point.timestamp)
      }
    }

    const series = dates.map(timestamp => valueByTimestamp.get(timestamp) ?? 0)
    const dashIndices = dates
      .map((timestamp, index) => (anomalyTimestamps.has(timestamp) ? index : -1))
      .filter(index => index !== -1)

    const item: VueUiXyDatasetItem = {
      name: applyEllipsis(packageName, 32),
      type: 'line',
      series,
      dashIndices,
    }

    if (isListedFramework(packageName)) {
      item.color = getFrameworkColor(packageName)
    }

    return item
  })

  return { dataset, dates }
}

type TrendsNormalisedDatasetItem = VueUiXyDatasetItem & {
  color?: string
  series: number[]
  dashIndices?: number[]
}

export function buildNormalisedTrendsDataset(options: {
  dataset: VueUiXyDatasetItem[] | null
  dates: number[]
  granularity: ChartTimeGranularity
  selectedMetric: TrendMetricId
  chartFilter: {
    averageWindow: number
    smoothingTau: number
    predictionPoints?: number
  }
  endDateMs?: number | null
  nowMs?: number
}): TrendsNormalisedDatasetItem[] {
  const referenceMs = options.endDateMs ?? options.nowMs ?? Date.now()
  const lastDateMs = options.dates.at(-1) ?? 0
  const isAbsoluteMetric = options.selectedMetric === 'contributors'

  return (options.dataset ?? []).map(item => {
    const sourceSeries = item.series.map(value => {
      if (typeof value === 'number') {
        return value
      }

      if (value && typeof value === 'object' && typeof value.y === 'number') {
        return value.y
      }

      return 0
    })

    const series = applyDataPipeline(
      sourceSeries,
      {
        averageWindow: options.chartFilter.averageWindow,
        smoothingTau: options.chartFilter.smoothingTau,
        predictionPoints:
          options.granularity === 'weekly'
            ? 0
            : (options.chartFilter.predictionPoints ?? DEFAULT_PREDICTION_POINTS),
      },
      {
        granularity: options.granularity,
        lastDateMs,
        referenceMs,
        isAbsoluteMetric,
      },
    )

    return Object.assign({}, item, {
      series,
      dashIndices: item.dashIndices ?? [],
    })
  })
}
export function getTrendsDatetimeFormatterOptions(granularity: ChartTimeGranularity) {
  return {
    daily: { year: 'yyyy-MM-dd', month: 'yyyy-MM-dd', day: 'yyyy-MM-dd' },
    weekly: { year: 'yyyy-MM-dd', month: 'yyyy-MM-dd', day: 'yyyy-MM-dd' },
    monthly: { year: 'MMM yyyy', month: 'MMM yyyy', day: 'MMM yyyy' },
    yearly: { year: 'yyyy', month: 'yyyy', day: 'yyyy' },
  }[granularity]
}

export function buildTrendsChartConfig(
  options: TrendChartConfigOptions & {
    dates: number[]
  },
): VueUiXyConfig {
  return {
    theme: options.isDarkMode ? 'dark' : ('' as VueDataUiTheme),
    downsample: {
      threshold: 5000,
    },
    a11y: {
      translations: {
        keyboardNavigation: options.t(
          'package.trends.chart_assistive_text.keyboard_navigation_horizontal',
        ),
        tableAvailable: options.t('package.trends.chart_assistive_text.table_available'),
        tableCaption: options.t('package.trends.chart_assistive_text.table_caption'),
      },
    },
    chart: {
      height: options.chartHeight,
      backgroundColor: options.colors.bg,
      padding: {
        bottom: options.displayedGranularity === 'yearly' ? 84 : 64,
        right: 145,
      },
      userOptions: {
        buttons: {
          pdf: false,
          labels: false,
          fullscreen: false,
          table: false,
          tooltip: false,
          altCopy: true,
        },
        buttonTitles: {
          csv: options.t('package.trends.download_file', { fileType: 'CSV' }),
          img: options.t('package.trends.download_file', { fileType: 'PNG' }),
          svg: options.t('package.trends.download_file', { fileType: 'SVG' }),
          annotator: options.t('package.trends.toggle_annotator'),
          stack: options.t('package.trends.toggle_stack_mode'),
          altCopy: options.t('package.trends.copy_alt.button_label'),
          open: options.t('package.trends.open_options'),
          close: options.t('package.trends.close_options'),
        },
        useCursorPointer: true,
      },
      grid: {
        position: 'start',
        stroke: options.colors.border,
        showHorizontalLines: true,
        labels: {
          fontSize: options.isMobile ? 24 : 16,
          color: options.pending ? options.colors.border : options.colors.fgSubtle,
          axis: {
            yLabel: options.t('package.trends.y_axis_label', {
              granularity: options.t(`package.trends.granularity_${options.selectedGranularity}`),
              facet: options.selectedMetricLabel,
            }),
            yLabelOffsetX: 12,
            fontSize: options.isMobile ? 32 : 24,
          },
          xAxisLabels: {
            show: true,
            showOnlyAtModulo: true,
            modulo: 12,
            values: options.dates,
            datetimeFormatter: {
              enable: true,
              locale: options.locale,
              useUTC: true,
              options: getTrendsDatetimeFormatterOptions(options.selectedGranularity),
            },
          },
          yAxis: {
            formatter: ({ value }: { value: number }) => {
              return options.compactNumberFormatter.format(Number.isFinite(value) ? value : 0)
            },
            useNiceScale: true,
            gap: 24,
          },
        },
      },
      timeTag: {
        show: true,
        backgroundColor: options.colors.bgElevated ?? options.colors.bg,
        color: options.colors.fg,
        fontSize: 16,
        circleMarker: {
          radius: 3,
          color: options.colors.border,
        },
        useDefaultFormat: true,
        timeFormat: 'yyyy-MM-dd HH:mm:ss',
      },
      highlighter: {
        useLine: true,
      },
      legend: {
        show: false,
        position: 'top',
      },
      tooltip: {
        teleportTo: options.inModal ? '#chart-modal' : undefined,
        position: (options.tooltipPosition ?? 'center') as TextAlign,
        offsetX: 24,
        offsetY: options.isMultiPackageMode ? undefined : -24,
        borderColor: 'transparent',
        backdropFilter: false,
        backgroundColor: 'transparent',
      },
    },
    line: {
      radius: 4,
      useGradient: true,
      dot: {
        useSerieColor: true,
      },
      labels: {
        show: false,
      },
      area: {
        useGradient: true,
        opacity: 12,
      },
    },
  }
}

export function drawTrendsEstimationLine(options: {
  svg: Record<string, any>
  colors: TrendColors
  shouldRender: boolean
}): string {
  if (!options.shouldRender) {
    return ''
  }

  const data = Array.isArray(options.svg?.data)
    ? options.svg.data
    : Array.isArray(options.svg?.series)
      ? options.svg.series
      : []

  if (!data.length) {
    return ''
  }

  const lines: string[] = []

  for (const serie of data) {
    const plots = serie?.plots

    if (!Array.isArray(plots) || plots.length < 2) {
      continue
    }

    const previousPoint = plots.at(-2)
    const lastPoint = plots.at(-1)

    if (!previousPoint || !lastPoint) {
      continue
    }

    const stroke = String(serie?.color ?? options.colors.fg)

    lines.push(`
            <line
                x1="${previousPoint.x}"
                y1="${previousPoint.y}"
                x2="${lastPoint.x}"
                y2="${lastPoint.y}"
                stroke="${options.colors.bg}"
                stroke-width="3"
                opacity="1"
            />
            <line
                x1="${previousPoint.x}"
                y1="${previousPoint.y}"
                x2="${lastPoint.x}"
                y2="${lastPoint.y}"
                stroke="${stroke}"
                stroke-width="3"
                stroke-dasharray="4 8"
                stroke-linecap="round"
            />
            <circle
                cx="${lastPoint.x}"
                cy="${lastPoint.y}"
                r="4"
                fill="${stroke}"
                stroke="${options.colors.bg}"
                stroke-width="2"
            />
        `)
  }

  return lines.join('\n')
}

export function drawTrendsLastDatapointLabel(options: {
  svg: Record<string, any>
  colors: TrendColors
  compactNumberFormatter: TrendFormatter
}): string {
  const data = Array.isArray(options.svg?.data)
    ? options.svg.data
    : Array.isArray(options.svg?.series)
      ? options.svg.series
      : []

  if (!data.length) {
    return ''
  }

  const labels: string[] = []

  for (const serie of data) {
    const lastPlot = serie?.plots?.at(-1)

    if (!lastPlot) {
      continue
    }

    labels.push(`
            <text
                text-anchor="start"
                dominant-baseline="middle"
                x="${lastPlot.x + 12}"
                y="${lastPlot.y}"
                font-size="24"
                fill="${options.colors.fg}"
                stroke="${options.colors.bg}"
                stroke-width="1"
                paint-order="stroke fill"
            >
                ${options.compactNumberFormatter.format(Number.isFinite(lastPlot.value) ? lastPlot.value : 0)}
            </text>
        `)
  }

  return labels.join('\n')
}

export function drawTrendsSvgPrintLegend(options: {
  svg: Record<string, any>
  colors: TrendColors
  showEstimationLegend: boolean
  estimationLabel: string
}): string {
  const data = Array.isArray(options.svg?.data)
    ? options.svg.data
    : Array.isArray(options.svg?.series)
      ? options.svg.series
      : []

  if (!data.length) {
    return ''
  }

  const output: string[] = []

  data.forEach((serie, index) => {
    output.push(`
            <rect
                x="${options.svg.drawingArea.left + 12}"
                y="${options.svg.drawingArea.top + 24 * index - 7}"
                width="12"
                height="12"
                fill="${serie.color}"
                rx="3"
            />
            <text
                text-anchor="start"
                dominant-baseline="middle"
                x="${options.svg.drawingArea.left + 32}"
                y="${options.svg.drawingArea.top + 24 * index}"
                font-size="16"
                fill="${options.colors.fg}"
                stroke="${options.colors.bg}"
                stroke-width="1"
                paint-order="stroke fill"
            >
                ${serie.name}
            </text>
        `)
  })

  if (options.showEstimationLegend) {
    output.push(`
            <line
                x1="${options.svg.drawingArea.left + 12}"
                y1="${options.svg.drawingArea.top + 24 * data.length}"
                x2="${options.svg.drawingArea.left + 24}"
                y2="${options.svg.drawingArea.top + 24 * data.length}"
                stroke="${options.colors.fg}"
                stroke-dasharray="4"
                stroke-linecap="round"
            />
            <text
                text-anchor="start"
                dominant-baseline="middle"
                x="${options.svg.drawingArea.left + 32}"
                y="${options.svg.drawingArea.top + 24 * data.length}"
                font-size="16"
                fill="${options.colors.fg}"
                stroke="${options.colors.bg}"
                stroke-width="1"
                paint-order="stroke fill"
            >
                ${options.estimationLabel}
            </text>
        `)
  }

  return output.join('\n')
}

export function generateWatermarkLogo({
  x,
  y,
  width,
  height,
  fill,
}: {
  x: number
  y: number
  width: number
  height: number
  fill: string
}) {
  return `
    <svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 330 125" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.848 97V85.288H34.752V97H22.848ZM56.4105 107.56L85.5945 25H93.2745L64.0905 107.56H56.4105ZM121.269 97V46.12H128.661L128.949 59.08L127.989 58.216C128.629 55.208 129.781 52.744 131.445 50.824C133.173 48.84 135.221 47.368 137.589 46.408C139.957 45.448 142.453 44.968 145.077 44.968C148.981 44.968 152.213 45.832 154.773 47.56C157.397 49.288 159.381 51.624 160.725 54.568C162.069 57.448 162.741 60.68 162.741 64.264V97H154.677V66.568C154.677 61.832 153.749 58.248 151.893 55.816C150.037 53.32 147.189 52.072 143.349 52.072C140.725 52.072 138.357 52.648 136.245 53.8C134.133 54.888 132.437 56.52 131.157 58.696C129.941 60.808 129.333 63.432 129.333 66.568V97H121.269ZM173.647 111.4V46.12H181.135L181.327 57.64L180.175 57.064C181.455 53.096 183.568 50.088 186.512 48.04C189.519 45.992 192.976 44.968 196.88 44.968C201.936 44.968 206.064 46.216 209.264 48.712C212.528 51.208 214.928 54.472 216.464 58.504C218 62.536 218.767 66.888 218.767 71.56C218.767 76.232 218 80.584 216.464 84.616C214.928 88.648 212.528 91.912 209.264 94.408C206.064 96.904 201.936 98.152 196.88 98.152C194.256 98.152 191.792 97.704 189.487 96.808C187.247 95.912 185.327 94.664 183.727 93.064C182.191 91.464 181.135 89.576 180.559 87.4L181.711 86.056V111.4H173.647ZM196.111 90.472C200.528 90.472 203.984 88.808 206.48 85.48C209.04 82.152 210.319 77.512 210.319 71.56C210.319 65.608 209.04 60.968 206.48 57.64C203.984 54.312 200.528 52.648 196.111 52.648C193.167 52.648 190.607 53.352 188.431 54.76C186.319 56.168 184.655 58.28 183.439 61.096C182.287 63.912 181.711 67.4 181.711 71.56C181.711 75.72 182.287 79.208 183.439 82.024C184.591 84.84 186.255 86.952 188.431 88.36C190.607 89.768 193.167 90.472 196.111 90.472ZM222.57 97V46.12H229.962L230.25 57.448L229.29 57.256C229.866 53.48 231.082 50.504 232.938 48.328C234.858 46.088 237.29 44.968 240.234 44.968C243.242 44.968 245.546 46.056 247.146 48.232C248.81 50.408 249.834 53.608 250.218 57.832H249.258C249.834 53.864 251.114 50.728 253.098 48.424C255.146 46.12 257.706 44.968 260.778 44.968C264.874 44.968 267.85 46.376 269.706 49.192C271.562 52.008 272.49 56.68 272.49 63.208V97H264.426V64.36C264.426 59.816 263.946 56.648 262.986 54.856C262.026 53 260.522 52.072 258.474 52.072C257.13 52.072 255.946 52.52 254.922 53.416C253.898 54.248 253.066 55.592 252.426 57.448C251.85 59.304 251.562 61.672 251.562 64.552V97H243.498V64.36C243.498 60.008 243.018 56.872 242.058 54.952C241.162 53.032 239.658 52.072 237.546 52.072C236.202 52.072 235.018 52.52 233.994 53.416C232.97 54.248 232.138 55.592 231.498 57.448C230.922 59.304 230.634 61.672 230.634 64.552V97H222.57ZM276.676 97L295.396 70.888L277.636 46.12H287.044L300.388 65.32L313.444 46.12H323.044L305.38 71.08L323.908 97H314.5L300.388 76.456L286.276 97H276.676Z" fill="${fill}"/>
    </svg>
  `
}
