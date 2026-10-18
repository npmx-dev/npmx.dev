<script setup lang="ts">
import {
  VueUiHeatmap,
  type VueUiHeatmapCell,
  type VueUiHeatmapConfig,
  type VueUiHeatmapDatapoint,
  type VueUiHeatmapDatasetItem,
  type VueUiHeatmapRow,
  type VueUiHeatmapSvgSlotProps,
} from 'vue-data-ui/vue-ui-heatmap'
import { useTooltipPosition } from 'vue-data-ui/composables'
import { adaptColorToBackground } from 'vue-data-ui/utils'
import { addDays, parseIsoDate, toIsoDate } from '~/utils/date'
import { applyBlocklistCorrection } from '~/utils/download-anomalies'
import { downloadFileLink } from '~/utils/download'
import { useCopyChartPng } from '~/composables/useCopyChartPng'
import { useElementSize } from '@vueuse/core'
import {
  sanitise,
  copyAltTextFromDownloadsHeatmap,
  CHART_ANNOTATOR_SLOTS,
  getAnnotatorIcon,
  getAnnotatorStyle,
} from '~/utils/charts'

type DailyDataPoint = {
  day: string
  value: number
  timestamp: number
  hasAnomaly?: boolean
}

const props = defineProps<{ packageName: string }>()
const chartRef = useTemplateRef('chartRef')

const { locale, localeProperties } = useI18n()
const isRTL = computed(() => localeProperties.value.dir === 'rtl')

const colorMode = useColorMode()
const isDarkMode = computed(() => colorMode.value === 'dark')
const rootEl = shallowRef<HTMLElement | null>(null)
const { width } = useElementSize(rootEl)
const { copy, copied } = useClipboard()
const tooltipPosition = useTooltipPosition(chartRef)
const { copiedPng, isCopyingPng, copyChartPng } = useCopyChartPng(chartRef)

onMounted(() => {
  rootEl.value = document.documentElement
})

const { colors } = useColors(rootEl)

const { fetchPackageDownloadEvolution } = useCharts()
const { settings } = useSettings()
const { accentColors, selectedAccentColor } = useAccentColor()
const compactNumberFormatter = useCompactNumberFormatter()

const source = shallowRef<DailyDataPoint[]>([])
const isLoading = ref(true)
const fetchError = shallowRef<string | null>(null)

const watermarkColors = computed(() => ({
  fg: colors.value.fg ?? OKLCH_NEUTRAL_FALLBACK,
  bg: colors.value.bg ?? OKLCH_NEUTRAL_FALLBACK,
  fgSubtle: colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK,
}))

const WEEK_COUNT = 52
const DAYS_PER_WEEK = 7
const WEEK_DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const

function toUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
}

function getDayKey(point: DailyDataPoint): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(point.day)) return point.day
  if (Number.isFinite(point.timestamp)) {
    const date = new Date(point.timestamp)
    if (Number.isFinite(date.getTime())) return toIsoDate(date)
  }
  return null
}

let currentRequest = 0

async function loadDownloads() {
  const request = ++currentRequest
  isLoading.value = true
  fetchError.value = null

  try {
    const yesterday = addDays(toUtcDay(new Date()), -1)
    const result = await fetchPackageDownloadEvolution(props.packageName, null, {
      granularity: 'day',
      startDate: toIsoDate(addDays(yesterday, -(WEEK_COUNT * DAYS_PER_WEEK) + 1)),
      endDate: toIsoDate(yesterday),
    })

    if (request === currentRequest) {
      source.value = result as DailyDataPoint[]
    }
  } catch (error) {
    if (request !== currentRequest) return

    source.value = []
    fetchError.value = error instanceof Error ? error.message : $t('package.trends.no_data')
  } finally {
    if (request === currentRequest) isLoading.value = false
  }
}

onMounted(loadDownloads)

// Flags known anomalies with `hasAnomaly` so they render as such, like in the trends chart
const correctedSource = computed(() =>
  settings.value.chartFilter.anomaliesFixed
    ? (applyBlocklistCorrection({
        data: source.value,
        packageName: props.packageName,
        granularity: 'daily',
      }) as DailyDataPoint[])
    : source.value,
)
watch(() => props.packageName, loadDownloads)

const tooltipDateFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }),
)
const monthFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      month: 'short',
      timeZone: 'UTC',
    }),
)

const weekdayLabels = computed(() => {
  const formatter = new Intl.DateTimeFormat(locale.value, {
    weekday: 'short',
    timeZone: 'UTC',
  })
  const today = toUtcDay(new Date())
  const startOffset = today.getUTCDay()
  return WEEK_DAYS.map((_, index) => formatter.format(addDays(today, index - startOffset)))
})

const dateRangeFormatter = computed(
  () =>
    new Intl.DateTimeFormat(locale.value, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    }),
)

const dateRange = computed(() => {
  const firstWeekStart = heatmap.value.weekStarts[0]
  const lastWeekStart = heatmap.value.weekStarts.at(-1)
  const endOfWeek = lastWeekStart ? addDays(parseIsoDate(lastWeekStart), DAYS_PER_WEEK - 1) : null
  const yesterday = addDays(toUtcDay(new Date()), -1)

  return {
    from: firstWeekStart ? dateRangeFormatter.value.format(parseIsoDate(firstWeekStart)) : '',
    to: endOfWeek
      ? dateRangeFormatter.value.format(endOfWeek > yesterday ? yesterday : endOfWeek)
      : '',
  }
})

const heatmap = computed(() => {
  const valuesByDate = new Map<string, number>()
  const anomalousDates = new Set<string>()
  const reportedDates = new Set<string>()

  for (const item of correctedSource.value) {
    const day = getDayKey(item)
    if (!day || !Number.isFinite(item.value)) continue
    reportedDates.add(day)
    valuesByDate.set(day, (valuesByDate.get(day) ?? 0) + item.value)
    if (item.hasAnomaly) anomalousDates.add(day)
  }

  const today = toUtcDay(new Date())
  const weekStartOffset = today.getUTCDay()
  const currentWeekStart = addDays(today, -weekStartOffset)
  const firstWeekStart = addDays(currentWeekStart, -(WEEK_COUNT - 1) * DAYS_PER_WEEK)

  const weeks = Array.from({ length: WEEK_COUNT }, (_, index) => {
    const start = addDays(firstWeekStart, index * DAYS_PER_WEEK)
    return { start, end: addDays(start, DAYS_PER_WEEK - 1) }
  })

  const dataset = WEEK_DAYS.map((name, dayIndex) => ({
    name,
    values: weeks.map(week => valuesByDate.get(toIsoDate(addDays(week.start, dayIndex))) ?? 0),
  }))

  let previousMonth = ''
  const xAxisValues = weeks.map(week => {
    // A month label belongs to the week containing that month's first day.
    const labelDate = week.start.getUTCMonth() === week.end.getUTCMonth() ? week.start : week.end
    const month = `${labelDate.getUTCFullYear()}-${labelDate.getUTCMonth()}`
    const label = month === previousMonth ? '' : monthFormatter.value.format(labelDate)
    previousMonth = month
    return label
  })

  return {
    dataset,
    xAxisValues,
    weekStarts: weeks.map(week => toIsoDate(week.start)),
    anomalousDates,
    reportedDates,
  }
})

const dataset = computed<VueUiHeatmapDatasetItem[]>(() => heatmap.value.dataset)

function computeMinMax(value: number, maxVal: number, date: string | null) {
  return {
    value: compactNumberFormatter.value.format(value),
    date: date ? dateRangeFormatter.value.format(parseIsoDate(date)) : '',
    color: transparentizeOklch(accent.value, maxVal > 0 ? 1 - value / maxVal : 1),
  }
}

const minMax = computed(() => {
  let minValue = Infinity
  let maxValue = 0
  let minDate: string | null = null
  let maxDate: string | null = null

  const { dataset: ds, weekStarts, reportedDates, anomalousDates } = heatmap.value

  for (const [dayIndex, row] of ds.entries()) {
    for (const [weekIndex, value] of row.values.entries()) {
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue

      const weekStart = weekStarts[weekIndex]
      if (!weekStart) continue

      const key = toIsoDate(addDays(parseIsoDate(weekStart), dayIndex))
      if (!reportedDates.has(key) || anomalousDates.has(key)) continue

      if (value < minValue) {
        minValue = value
        minDate = key
      }

      if (value > maxValue) {
        maxValue = value
        maxDate = key
      }
    }
  }

  return {
    min: computeMinMax(Number.isFinite(minValue) ? minValue : 0, maxValue, minDate),
    max: computeMinMax(maxValue, maxValue, maxDate),
  }
})

const accentColorValueById = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const item of accentColors.value) {
    map[item.id] = item.value
  }
  return map
})

const accent = computed(() => {
  const id = selectedAccentColor.value
  return id
    ? (accentColorValueById.value[id] ?? colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK)
    : (colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK)
})

const CELL_SPACING = 1

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

function buildExportFilename(extension: 'png' | 'csv' | 'svg') {
  return `${sanitise(props.packageName)}_${$t('package.trends.downloads_heatmap.title', dateRange.value).replaceAll(' ', '_').replaceAll('/', '-')}.${extension}`
}

const config = computed<VueUiHeatmapConfig>(() => ({
  userOptions: {
    useCursorPointer: true,
    buttons: {
      pdf: false,
      fullscreen: false,
      table: false,
      tooltip: false,
      altCopy: true,
      annotator: !isMobile.value,
    },
    buttonTitles: {
      csv: $t('package.trends.download_file', { fileType: 'CSV' }),
      img: $t('package.trends.download_file', { fileType: 'PNG' }),
      svg: $t('package.trends.download_file', { fileType: 'SVG' }),
      annotator: $t('package.trends.toggle_annotator'),
      altCopy: $t('package.trends.copy_alt.button_label'),
    },
    callbacks: {
      img: args => {
        const imageUri = args?.imageUri
        if (!imageUri) return
        downloadFileLink(imageUri, buildExportFilename('png'))
      },
      csv: csvStr => {
        if (!csvStr) return

        const subtitle = $t('package.trends.downloads_heatmap.title', dateRange.value)
        const csv = csvStr
          .replace('data:text/csv;charset=utf-8,', '')
          .replace(`\n${subtitle}`, ` ${subtitle}`)

        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
        downloadFileLink(url, buildExportFilename('csv'))
        URL.revokeObjectURL(url)
      },
      svg: args => {
        const blob = args?.blob
        if (!blob) return
        const url = URL.createObjectURL(blob)
        downloadFileLink(url, buildExportFilename('svg'))
        URL.revokeObjectURL(url)
      },
      altCopy: () => {
        copyAltTextFromDownloadsHeatmap({
          dataset: dataset.value,
          config: {
            packageName: props.packageName,
            dateRange: dateRange.value,
            weekStarts: heatmap.value.weekStarts,
            reportedDates: heatmap.value.reportedDates,
            anomalousDates: heatmap.value.anomalousDates,
            locale: locale.value,
            copy,
            $t,
          },
        })
      },
    },
  },
  style: {
    fontFamily: 'inherit',
    backgroundColor: colors.value.bg,
    color: colors.value.fg,
    layout: {
      height: 269,
      padding: { top: 0, bottom: 96, left: -12 },
      cells: {
        height: 24,
        rowTotal: { value: { show: false }, color: { show: false } },
        columnTotal: {
          value: { show: false, rotation: 0, offsetX: 0, offsetY: 0 },
          color: { show: false },
        },
        value: {
          show: false,
          fontSize: 8,
          bold: false,
          roundingValue: 0,
          color: isDarkMode.value ? '#FAFAFA' : '#1A1A1A',
        },
        colors: {
          hot: accent.value,
          cold: colors.value.bg,
          underlayer: colors.value.bg,
        },
        spacing: CELL_SPACING,
        selected: { border: 2, color: colors.value.fg },
      },
      dataLabels: {
        xAxis: {
          show: true,
          values: heatmap.value.xAxisValues,
          fontSize: 12,
          color: isDarkMode.value ? '#BBBBBB' : '#1A1A1A',
          bold: false,
          offsetX: 0,
          offsetY: 12,
          showOnlyAtModulo: 1,
          autoRotate: { enable: false },
        },
        yAxis: {
          show: true,
          values: weekdayLabels.value,
          fontSize: 14,
          color: isDarkMode.value ? '#BBBBBB' : '#1A1A1A',
          bold: false,
          offsetY: 0,
          offsetX: 0,
        },
      },
    },
    title: {
      textAlign: isRTL.value ? 'center' : 'left',
      text: props.packageName,
      color: colors.value.fg,
      fontSize: 16,
      bold: false,
      margin: '0 0 6px 0',
      subtitle: {
        color: '#A1A1A1',
        text: $t('package.trends.downloads_heatmap.title', dateRange.value),
        fontSize: 12,
        bold: false,
      },
    },
    legend: {
      show: false,
      backgroundColor: isDarkMode.value ? '#1A1A1A' : '#f3f4f6',
      color: isDarkMode.value ? '#BBBBBB' : '#1A1A1A',
      fontSize: 12,
      bold: true,
      roundingValue: 0,
      width: 48,
    },
    tooltip: {
      position: tooltipPosition.value,
      show: true,
      backgroundColor: isDarkMode.value ? '#1A1A1A' : '#FFFFFF',
      color: isDarkMode.value ? '#BBBBBB' : '#1A1A1A',
      fontSize: 14,
      offsetX: 24,
      offsetY: -36,
      backgroundOpacity: 20,
      borderColor: colors.value.border,
    },
  },
}))

function getTooltipDate(
  datapoint: VueUiHeatmapDatapoint,
  seriesIndex: number,
  series: VueUiHeatmapRow[],
): string {
  const columnIndex =
    series?.[seriesIndex]?.temperatures?.findIndex(
      temperature => temperature.id === datapoint?.id,
    ) ?? -1
  const weekStart = heatmap.value.weekStarts[columnIndex]
  if (!weekStart || seriesIndex < 0 || seriesIndex >= DAYS_PER_WEEK) return ''
  return tooltipDateFormatter.value.format(addDays(parseIsoDate(weekStart), seriesIndex))
}

function isUnknownTooltipDay(
  datapoint: VueUiHeatmapDatapoint,
  seriesIndex: number,
  series: VueUiHeatmapRow[],
): boolean {
  const columnIndex =
    series?.[seriesIndex]?.temperatures?.findIndex(
      temperature => temperature.id === datapoint?.id,
    ) ?? -1
  const weekStart = heatmap.value.weekStarts[columnIndex]
  if (!weekStart || seriesIndex < 0 || seriesIndex >= DAYS_PER_WEEK) return false
  const key = toIsoDate(addDays(parseIsoDate(weekStart), seriesIndex))
  return columnIndex >= WEEK_COUNT - 2 && !heatmap.value.reportedDates.has(key)
}

function getCellDate(cell: VueUiHeatmapCell): Date | null {
  const weekStart = heatmap.value.weekStarts[cell.columnIndex]
  return weekStart ? addDays(parseIsoDate(weekStart), cell.rowIndex) : null
}

function isUnrecorded(cell: VueUiHeatmapCell): boolean {
  const date = getCellDate(cell)
  if (!date) return false
  const key = toIsoDate(date)
  return (
    heatmap.value.anomalousDates.has(key) ||
    (heatmap.value.reportedDates.has(key) && cell.datapoint.value === 0) ||
    showUnknownDay(cell)
  )
}

function showUnknownDay(cell: VueUiHeatmapCell): boolean {
  const date = getCellDate(cell)
  return (
    !!date &&
    cell.columnIndex >= WEEK_COUNT - 2 &&
    !heatmap.value.reportedDates.has(toIsoDate(date))
  )
}

function getMissingDaySymbol(cell: VueUiHeatmapCell): string {
  const cx = cell.x + cell.width / 2
  const cy = cell.y + cell.height / 2
  const date = getCellDate(cell)
  const isPending = showUnknownDay(cell) && !!date && date >= toUtcDay(new Date())
  const shape = isPending ? '' : '-6-6m6 6 6 6m0-12-12 12'
  return `m${cx} ${cy}${shape}`
}

/**
 * Adapt legend placement depending on the locale direction
 */
function getLegendContent(svg: VueUiHeatmapSvgSlotProps['svg']) {
  const y = svg.drawingArea.bottom + 10
  const lineHeight = 24
  const fontSize = 16
  const fill = colors.value.fgSubtle
  const textAnchor = 'start'
  const dominantBaseline = 'middle'
  const colorMarkerConfig = { width: 16, height: 16, stroke: colors.value.border }
  const textConfig = {
    'font-size': fontSize,
    'dominant-baseline': dominantBaseline,
    'text-anchor': textAnchor,
    'fill': fill,
    'direction': isRTL.value ? 'rtl' : 'ltr',
  }
  const anomaliesConfig = {
    'stroke': isDarkMode.value ? colors.value.borderHover : colors.value.border,
    'stroke-width': 2,
    'fill': 'none',
  }

  if (isRTL.value) {
    const x = svg.width - 30
    return {
      anomalies: {
        marker: {
          d: `m${x} ${y}-7-7m7 7 7 7m-14 0 14-14`,
          ...anomaliesConfig,
        },
        text: {
          x: x - 26,
          y: y + 1,
          ...textConfig,
        },
      },
      min: {
        marker: { x: x - 8, y: y + 15, fill: minMax.value.min.color, ...colorMarkerConfig },
        text: {
          x: x - 26,
          y: y + lineHeight + 1,
          ...textConfig,
        },
      },
      max: {
        marker: {
          x: x - 8,
          y: y + lineHeight + 15,
          fill: minMax.value.max.color,
          ...colorMarkerConfig,
        },
        text: {
          x: x - 26,
          y: y + lineHeight * 2 + 1,
          ...textConfig,
        },
      },
    }
  }

  const x = svg.drawingArea.left + 25
  return {
    anomalies: {
      marker: {
        d: `m${x} ${y}-7-7m7 7 7 7m-14 0 14-14`,
        ...anomaliesConfig,
      },
      text: {
        x: x + 16,
        y: y + 1,
        ...textConfig,
      },
    },
    min: {
      marker: { x: x - 8, y: y + 15, fill: minMax.value.min.color, ...colorMarkerConfig },
      text: {
        x: x + 16,
        y: y + lineHeight + 1,
        ...textConfig,
      },
    },
    max: {
      marker: {
        x: x - 8,
        y: y + lineHeight + 15,
        fill: minMax.value.max.color,
        ...colorMarkerConfig,
      },
      text: {
        x: x + 16,
        y: y + lineHeight * 2 + 1,
        ...textConfig,
      },
    },
  }
}
</script>

<template>
  <div class="w-full font-mono">
    <div v-if="fetchError" class="py-6 text-sm text-red-600 dark:text-red-400" role="alert">
      {{ fetchError }}
    </div>
    <SkeletonBlock v-else-if="isLoading" class="aspect-[676/172]" />
    <div v-else-if="source.length" class="w-full overflow-visible">
      <ClientOnly>
        <div>
          <VueUiHeatmap ref="chartRef" :dataset="dataset" :config="config" class="[direction:ltr]">
            <!-- Keyboard navigation hint -->
            <template #hint="{ isVisible }">
              <p
                v-if="isVisible"
                class="text-accent text-xs -mt-5 text-center px-2"
                aria-hidden="true"
              >
                {{ $t('package.trends.downloads_heatmap.nav_hint') }}
              </p>
            </template>

            <template #svg="{ svg }">
              <template v-for="cell in svg.cells" :key="cell.datapoint.id">
                <g v-if="isUnrecorded(cell)" pointer-events="none">
                  <rect
                    :x="cell.x + 2"
                    :y="cell.y + 2"
                    :width="Math.max(0, cell.width - 4)"
                    :height="Math.max(0, cell.height - 4)"
                    :fill="colors.bg"
                  />
                  <path
                    :d="getMissingDaySymbol(cell)"
                    :stroke="isDarkMode ? colors.borderHover : colors.border"
                    stroke-linecap="round"
                    :stroke-width="showUnknownDay(cell) ? 1.5 : 2"
                    fill="none"
                  />
                </g>
              </template>

              <!-- BOTTOM LEGEND -->
              <template v-for="legend in [getLegendContent(svg)]" :key="'legend'">
                <!-- Anomalies -->
                <path v-bind="legend.anomalies.marker" />
                <text v-bind="legend.anomalies.text">
                  {{ $t('package.trends.downloads_heatmap.legend.anomalies') }}
                </text>

                <!-- Max -->
                <rect v-bind="legend.max.marker" />
                <text v-bind="legend.max.text">
                  {{
                    $t('package.trends.downloads_heatmap.legend.max', {
                      value: minMax.max.value,
                      date: minMax.max.date,
                    })
                  }}
                </text>

                <!-- Min -->
                <rect v-bind="legend.min.marker" />
                <text v-bind="legend.min.text">
                  {{
                    $t('package.trends.downloads_heatmap.legend.min', {
                      value: minMax.min.value,
                      date: minMax.min.date,
                    })
                  }}
                </text>
              </template>

              <!-- Print watermark-->
              <g
                v-if="svg.isPrintingSvg || svg.isPrintingImg || isCopyingPng"
                v-html="
                  drawSmallNpmxLogoAndTaglineWatermark({
                    svg: {
                      ...svg,
                    },
                    colors: watermarkColors,
                    translateFn: $t,
                  })
                "
              />
            </template>

            <!-- Custom tooltip -->
            <template #tooltip="{ datapoint, seriesIndex, series }">
              <div class="px-1 text-start font-mono">
                <div class="mt-0.5 text-xs text-gray-900 dark:text-gray-100">
                  {{ getTooltipDate(datapoint, seriesIndex, series) }}
                </div>
                <div class="mt-2 flex items-center gap-2">
                  <span
                    class="h-3.5 w-3.5 shrink-0 relative"
                    :style="{
                      backgroundColor: datapoint.color,
                      border: `0.5px solid ${adaptColorToBackground(datapoint.color, {
                        dark: isDarkMode ? '#3A3A3A' : '#6A6A6A',
                        light: isDarkMode ? '#6A6A6A' : '#CCCCCC',
                      })}`,
                    }"
                  >
                    <svg
                      v-if="
                        !isUnknownTooltipDay(datapoint, seriesIndex, series) && !datapoint.value
                      "
                      viewBox="0 0 16 16"
                      class="absolute top-1/2 inset-is-1/2 -translate-x-1/2 -translate-y-1/2 w-full p-0.25"
                    >
                      <path
                        d="M8 8 1 1M8 8 15 15M1 15 15 1"
                        :stroke="isDarkMode ? colors.borderHover : colors.border"
                        stroke-width="2"
                        fill="none"
                      />
                    </svg>
                  </span>
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    {{
                      isUnknownTooltipDay(datapoint, seriesIndex, series)
                        ? '-'
                        : compactNumberFormatter.format(Number(datapoint.value) || 0)
                    }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Chart context menu -->
            <template #menuIcon="{ isOpen }">
              <span v-if="isOpen" class="i-lucide:x w-6 h-6" aria-hidden="true" />
              <span v-else class="i-lucide:ellipsis-vertical w-6 h-6" aria-hidden="true" />
            </template>
            <template #optionCsv>
              <span class="text-fg-subtle font-mono pointer-events-none">CSV</span>
            </template>
            <template #custom-menu-before>
              <ChartCopyPngButton
                :copied="copiedPng"
                :copying="isCopyingPng"
                @click="copyChartPng"
              />
            </template>
            <template #optionImg>
              <span class="text-fg-subtle font-mono pointer-events-none">PNG</span>
            </template>
            <template #optionSvg>
              <span class="text-fg-subtle font-mono pointer-events-none">SVG</span>
            </template>

            <template #optionAltCopy>
              <span
                class="w-6 h-6"
                :class="
                  copied ? 'i-lucide:check text-accent' : 'i-lucide:person-standing text-fg-subtle'
                "
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template v-for="slotName in CHART_ANNOTATOR_SLOTS" #[slotName]="slotProps">
              <span
                v-if="getAnnotatorIcon(slotName, slotProps)"
                class="w-6 h-6"
                :class="[
                  getAnnotatorIcon(slotName, slotProps),
                  slotName === 'annotator-action-color' ? null : 'text-fg-subtle',
                ]"
                :style="getAnnotatorStyle(slotName, slotProps)"
                aria-hidden="true"
              />
            </template>
          </VueUiHeatmap>
        </div>
        <template #fallback>
          <SkeletonBlock class="aspect-[676/172]" />
        </template>
      </ClientOnly>
    </div>
    <p v-else class="py-6 text-sm text-fg-subtle">
      {{ $t('package.trends.no_data') }}
    </p>
  </div>
</template>
