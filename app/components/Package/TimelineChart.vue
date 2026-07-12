<script setup lang="ts">
import {
  VueUiXy,
  type VueUiXyConfig,
  type VueUiXyDatasetBarItem,
  type VueUiXyDatasetItem,
  type VueUiXyDatasetLineItem,
  type VueUiXyDatasetPlotItem,
} from 'vue-data-ui/vue-ui-xy'
import {
  VueUiStackbar,
  type VueUiStackbarConfig,
  type VueUiStackbarDatasetItem,
  type VueUiStackbarFormattedDatasetItem,
  type VueUiStackbarTooltipDatapoint,
} from 'vue-data-ui/vue-ui-stackbar'
import { useTooltipPosition } from 'vue-data-ui/composables'
import {
  sanitise,
  applyEllipsis,
  copyAltTextForTimelineChart,
  type EnrichedTimelineSizeCacheEntry,
  type TimelineSizeCacheValue,
  CHART_ANNOTATOR_SLOTS,
  E18E_GRADIENT_COLORS,
  getAnnotatorIcon,
  getAnnotatorStyle,
  type TimelineChartMetric,
  type StackbarTooltipPoint,
  type TimelinePlotItem,
  type TimelineMarkerItem,
} from '~/utils/charts'
import type { TimelineVersion, SubEvent } from '~~/server/api/registry/timeline/[...pkg].get'
import { drawSmallNpmxLogoAndTaglineWatermark } from '~/composables/useChartWatermark'
import { useColors } from '~/composables/useColors'
import { parseStableVersion } from '~/utils/versions'
import { downloadFileLink } from '~/utils/download'
import { useElementSize, useTimeoutFn } from '@vueuse/core'
import TimelineChartDepSizeTooltip from './TimelineChartDepSizeTooltip.vue'
import TimelineChartXyTooltip from './TimelineChartXyTooltip.vue'
import TimelineChartXySvgSlot from './TimelineChartXySvgSlot.vue'
import TimelineChartDepSizeSvgSlot from './TimelineChartDepSizeSvgSlot.vue'

import('vue-data-ui/style.css')

const props = defineProps<{
  sizeCache: Map<string, TimelineSizeCacheValue>
  versionSubEvents: Map<string, SubEvent[]>
  timelineEntries: TimelineVersion[]
  selectedVersion: string | null
  loading: boolean
}>()

const { settings } = useSettings()
const route = useRoute('timeline')
const chartRef = useTemplateRef('chartRef')
const activeVersion = computed(() => route.params.version)

const packageName = computed(() =>
  route.params.org ? `${route.params.org}/${route.params.packageName}` : route.params.packageName,
)

function addEvaluationFlags(
  entries: EnrichedTimelineSizeCacheEntry[],
  versionSubEvents: Map<string, SubEvent[]>,
): EnrichedTimelineSizeCacheEntry[] {
  return entries.map(entry => {
    const events = versionSubEvents.get(entry.version) ?? []

    return {
      ...entry,
      events,
      hasPositive: events.some(event => event.positive),
      hasNegative: events.some(event => !event.positive),
    }
  })
}

const convertedData = computed(() => {
  const entries = props.timelineEntries.flatMap(timelineEntry => {
    const key = `${packageName.value}@${timelineEntry.version}`
    const value = props.sizeCache.get(key)

    if (!value) {
      return []
    }

    return {
      name: key,
      totalSize: value.totalSize,
      dependencyCount: value.dependencyCount,
      selfSize: value.selfSize,
      dependencies: value.dependencies,
      version: timelineEntry.version,
      time: timelineEntry.time,
      license: timelineEntry.license,
      type: timelineEntry.type,
      hasTypes: timelineEntry.hasTypes,
      hasTrustedPublisher: timelineEntry.hasTrustedPublisher,
      hasProvenance: timelineEntry.hasProvenance,
      tags: timelineEntry.tags ?? [],
      events: [],
      hasPositive: false,
      hasNegative: false,
    }
  })

  return addEvaluationFlags(entries, props.versionSubEvents).toReversed()
})

type StableVersion = {
  major: number
  minor: number
  patch: number
}

const orderedConvertedData = computed(() => {
  if (!settings.value.timelineChart.isOrdered) {
    return convertedData.value
  }

  // Hide pre-releases and reorder stable versions semantically
  return convertedData.value
    .map(entry => ({
      entry,
      parsedVersion: parseStableVersion(entry.version),
    }))
    .filter(
      (
        item,
      ): item is { entry: (typeof convertedData.value)[number]; parsedVersion: StableVersion } => {
        return item.parsedVersion !== null
      },
    )
    .toSorted((a, b) => {
      if (a.parsedVersion.major !== b.parsedVersion.major) {
        return a.parsedVersion.major - b.parsedVersion.major
      }
      if (a.parsedVersion.minor !== b.parsedVersion.minor) {
        return a.parsedVersion.minor - b.parsedVersion.minor
      }
      return a.parsedVersion.patch - b.parsedVersion.patch
    })
    .map(item => item.entry)
})

watch(
  orderedConvertedData,
  async () => {
    await nextTick()
    const chart = chartRef.value
    if (!chart || !('resetZoom' in chart) || typeof chart.resetZoom !== 'function') return
    chart.resetZoom()
  },
  { flush: 'post' },
)

const versions = computed(() => orderedConvertedData.value.map(d => d.version))

const activeVersionIndex = computed(() => {
  if (!activeVersion.value) return -1
  return versions.value.findIndex(v => v === activeVersion.value)
})

const seriesTotalSize = computed(() => {
  const values = orderedConvertedData.value.map(d => d.totalSize)
  if (!values.length) {
    return { values, min: 0, max: 0 }
  }
  return {
    values,
    min: Math.min(...values),
    max: Math.max(...values),
  }
})

const seriesDependencies = computed(() => {
  const values = orderedConvertedData.value.map(d => d.dependencyCount)
  if (!values.length) {
    return { values, min: 0, max: 0 }
  }
  return {
    values,
    min: Math.min(...values),
    max: Math.max(...values),
  }
})

const activeTab = shallowRef<TimelineChartMetric>('totalSize')

const shouldPauseChartAnimations = shallowRef(true)

const { start: startChartAnimationPauseTimer } = useTimeoutFn(
  () => {
    shouldPauseChartAnimations.value = false
  },
  1000,
  { immediate: false },
)

function pauseChartAnimations() {
  shouldPauseChartAnimations.value = true
  startChartAnimationPauseTimer()
}

watch(
  () => activeTab.value,
  () => pauseChartAnimations(),
  { flush: 'sync' },
)

// After this number of segments, the rest go into an "Other" segment
const DEP_SEGMENT_COUNT = 8

// Segment colours
const dependencyPalette = Array.from(
  { length: DEP_SEGMENT_COUNT },
  (_, i) => `oklch(72% 0.14 ${Math.round((i * 360) / DEP_SEGMENT_COUNT)})`,
)

interface DependencySegment {
  key: string
  name: string
  color: string
  series: number[]
}

// Creates the segments for the dependency size chart. Basically, each
// significantly sized dependency is a segment, the package itself is a segment,
// and the rest is a segment ("Other").
const dependencySegments = computed<DependencySegment[]>(() => {
  const data = orderedConvertedData.value
  const reference = data.at(-1)
  if (!reference) return []

  const topNames = reference.dependencies.slice(0, DEP_SEGMENT_COUNT).map(dep => dep.name)
  const topNameSet = new Set(topNames)

  const selfSegment: DependencySegment = {
    key: '__self__',
    name: packageName.value,
    color: colors.value.accent ?? OKLCH_NEUTRAL_FALLBACK,
    series: data.map(d => d.selfSize ?? 0),
  }

  const depSegments: DependencySegment[] = topNames.map((name, i) => ({
    key: name,
    name,
    color: dependencyPalette[i]!,
    series: data.map(d => d.dependencies.find(dep => dep.name === name)?.size ?? 0),
  }))

  const otherSegment: DependencySegment = {
    key: '__other__',
    name: $t('package.timeline.chart.other_dependencies'),
    color: colors.value.border ?? OKLCH_NEUTRAL_FALLBACK,
    series: data.map(d => {
      const named = d.dependencies.reduce(
        (sum, dep) => (topNameSet.has(dep.name) ? sum + dep.size : sum),
        0,
      )
      return Math.max(0, (d.totalSize ?? 0) - (d.selfSize ?? 0) - named)
    }),
  }

  // bottom to top
  return [otherSegment, ...depSegments.toReversed(), selfSegment]
})

function stackbarTooltipPoints(
  datapoint: VueUiStackbarTooltipDatapoint[],
  versionIndex: number,
): StackbarTooltipPoint[] {
  return datapoint
    .map(point => {
      const segment = dependencySegments.value.find(s => s.name === point.name)
      const previous = versionIndex > 0 ? (segment?.series[versionIndex - 1] ?? 0) : 0
      const value = point.value ?? 0
      const removed = value === 0 && previous > 0

      return {
        id: point.id,
        name: point.name,
        color: point.color,
        size: removed ? previous : value,
        delta: versionIndex > 0 ? value - previous : 0,
        removed,
      }
    })
    .filter(point => point.size > 0)
    .toReversed()
}

function areAllValuesEqual(array: number[]): boolean {
  if (array.length <= 1) return true
  return array.every(value => value === array[0])
}

const datasets = computed<{
  totalSize: VueUiXyDatasetItem[]
  dependencyCount: VueUiXyDatasetItem[]
  dependencySize: VueUiStackbarDatasetItem[]
}>(() => {
  return {
    dependencySize: dependencySegments.value.map(segment => ({
      name: segment.name,
      series: segment.series,
      color: segment.color,
    })),
    totalSize: [
      {
        name: $t('package.stats.install_size'),
        type: 'line',
        useStepper: true,
        series: seriesTotalSize.value.values,
        temperatureColors: areAllValuesEqual(seriesTotalSize.value.values)
          ? undefined
          : E18E_GRADIENT_COLORS,
        color: colors.value.fgSubtle,
        source: orderedConvertedData.value,
      },
    ],
    dependencyCount: [
      {
        name: $t('compare.dependencies'),
        type: 'line',
        useStepper: true,
        series: seriesDependencies.value.values,
        temperatureColors: areAllValuesEqual(seriesDependencies.value.values)
          ? undefined
          : E18E_GRADIENT_COLORS,
        color: colors.value.fgSubtle,
        source: orderedConvertedData.value,
      },
    ],
  }
})

const { copy, copied } = useClipboard()

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const { width } = useElementSize(rootEl)

const compactNumberFormatter = useCompactNumberFormatter()
const bytesFormatter = useBytesFormatter()
const intFormatter = useNumberFormatter({
  notation: 'compact',
  compactDisplay: 'short',
  maximumFractionDigits: 0,
})

const formatter = computed(() =>
  activeTab.value === 'dependencyCount' ? intFormatter.value : bytesFormatter,
)

onMounted(() => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
  pauseChartAnimations()
})

const { colors } = useColors(rootEl)

watch(
  () => colorMode.value,
  value => {
    resolvedMode.value = value === 'dark' ? 'dark' : 'light'
  },
  { flush: 'sync' },
)

const isDarkMode = computed(() => resolvedMode.value === 'dark')

const watermarkColors = computed(() => ({
  fg: colors.value.fg ?? OKLCH_NEUTRAL_FALLBACK,
  bg: colors.value.bg ?? OKLCH_NEUTRAL_FALLBACK,
  fgSubtle: colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK,
}))

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

const commonScaleSteps = computed(() => {
  if (activeTab.value === 'totalSize') {
    return seriesTotalSize.value.max - seriesTotalSize.value.min > 5 ? 6 : 2
  }
  return seriesDependencies.value.max - seriesDependencies.value.min > 5 ? 6 : 2
})

const metricLabel = computed(() => {
  switch (activeTab.value) {
    case 'dependencyCount':
      return $t('compare.dependencies')
    case 'dependencySize':
      return $t('package.timeline.chart.dependency_size')
    default:
      return $t('package.stats.install_size')
  }
})

function buildExportFilename(extension: 'png' | 'csv' | 'svg') {
  return `${sanitise(packageName.value)}_${$t('package.links.timeline')}_${metricLabel.value.toLocaleLowerCase().replaceAll(' ', '-')}.${extension}`
}

const tooltipPosition = useTooltipPosition(chartRef)

type XyUserOptions = NonNullable<NonNullable<VueUiXyConfig['chart']>['userOptions']>

type StackbarUserOptions = NonNullable<NonNullable<VueUiXyConfig['chart']>['userOptions']>

type CommonUserOptions = XyUserOptions & StackbarUserOptions

const commonConfig = computed<CommonUserOptions>(() => ({
  callbacks: {
    img: args => {
      const imageUri = args?.imageUri
      if (!imageUri) return
      downloadFileLink(imageUri, buildExportFilename('png'))
    },
    csv: csvStr => {
      if (!csvStr) return
      const PLACEHOLDER_CHAR = '\0'
      const multilineDateTemplate = $t('package.trends.date_range_multiline', {
        start: PLACEHOLDER_CHAR,
        end: PLACEHOLDER_CHAR,
      })
        .replaceAll(PLACEHOLDER_CHAR, '')
        .trim()
      const blob = new Blob([
        csvStr
          .replace('data:text/csv;charset=utf-8,', '')
          .replaceAll(`\n${multilineDateTemplate}`, ` ${multilineDateTemplate}`),
      ])
      const url = URL.createObjectURL(blob)
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
  },
  buttonTitles: {
    csv: $t('package.trends.download_file', { fileType: 'CSV' }),
    img: $t('package.trends.download_file', { fileType: 'PNG' }),
    svg: $t('package.trends.download_file', { fileType: 'SVG' }),
    annotator: $t('package.trends.toggle_annotator'),
    stack: $t('package.trends.toggle_stack_mode'),
    altCopy: $t('package.trends.copy_alt.button_label'),
    open: $t('package.trends.open_options'),
    close: $t('package.trends.close_options'),
  },
}))

const config = computed<VueUiXyConfig>(() => {
  return {
    theme: isDarkMode.value ? 'dark' : '',
    downsample: {
      threshold: 5000,
    },
    line: {
      useGradient: false,
      radius: 2,
      dot: {
        useSerieColor: false,
        fill: colors.value.bg,
      },
    },
    chart: {
      backgroundColor: colors.value.bg,
      height: 200,
      highlighter: {
        useLine: true,
        color: colors.value.accent,
      },
      grid: {
        position: 'start',
        showHorizontalLines: true,
        stroke: colors.value.border,
        labels: {
          color: colors.value.fgSubtle,
          fontSize: isMobile.value ? 18 : 14,
          axis: {
            yLabel: metricLabel.value,
            fontSize: isMobile.value ? 24 : 14,
          },
          xAxisLabels: {
            color: colors.value.fgSubtle,
            fontSize: isMobile.value ? 12 : 10,
            modulo: Math.min(32, Math.round(versions.value.length / 2)),
            showOnlyAtModulo: versions.value.length > 32,
            values: versions.value.map(v => applyEllipsis(v, 20)),
            rotation: -30,
            autoRotate: {
              enable: false,
            },
          },
          yAxis: {
            commonScaleSteps: commonScaleSteps.value,
            formatter: ({ value }) => {
              return formatter.value.format(value ?? 0)
            },
            scaleMin: settings.value.timelineChart.isZeroBased
              ? 0
              : activeTab.value === 'totalSize'
                ? seriesTotalSize.value.min
                : seriesDependencies.value.min,
            stacked: false,
            useIndividualScale: false,
            useNiceScale: true,
          },
        },
      },
      legend: { show: false },
      padding: {
        top: 32,
      },
      title: {
        text: applyEllipsis(packageName.value, 32),
        fontSize: isMobile.value ? 14 : 18,
        bold: false,
        color: colors.value.fg,
      },
      tooltip: {
        position: tooltipPosition.value,
        offsetX: 24,
        borderColor: colors.value.border,
        borderRadius: 6,
        backgroundColor: colors.value.bg,
        backgroundOpacity: 10,
      },
      userOptions: {
        buttons: {
          pdf: false,
          labels: false,
          fullscreen: false,
          table: false,
          tooltip: false,
          altCopy: true,
          annotator: !isMobile.value,
        },
        buttonTitles: commonConfig.value.buttonTitles,
        callbacks: {
          img: commonConfig.value.callbacks!.img,
          csv: commonConfig.value.callbacks!.csv,
          svg: commonConfig.value.callbacks!.svg,
          altCopy: () =>
            copyAltTextForTimelineChart({
              dataset: orderedConvertedData.value,
              config: {
                packageName: packageName.value,
                metric: activeTab.value,
                copy,
                $t,
                numberFormatter: formatter.value.format,
              },
            }),
        },
        useCursorPointer: true,
      },
      zoom: {
        show: settings.value.timelineChart.showZoom,
        maxWidth: isMobile.value ? 350 : 500,
        highlightColor: colors.value.bgElevated,
        useResetSlot: true,
        keepState: true,
        minimap: {
          show: true,
          lineColor: '#FAFAFA',
          indicatorColor: colors.value.accent,
          selectedColor: colors.value.accent,
          selectedColorOpacity: 0.06,
          frameColor: colors.value.border,
          handleWidth: isMobile.value ? 40 : 20, // does not affect the size of the touch area
          handleBorderColor: colors.value.fgSubtle,
          handleType: 'grab', // 'empty' | 'chevron' | 'arrow' | 'grab'
        },
        preview: {
          fill: transparentizeOklch(colors.value.accent, isDarkMode.value ? 0.95 : 0.92),
          stroke: transparentizeOklch(colors.value.accent, 0.5),
          strokeWidth: 1,
          strokeDasharray: 3,
        },
      },
    },
  }
})

type TimelineSourceItem = {
  version?: string
  tags?: string[]
  events?: SubEvent[]
  hasPositive?: boolean
  hasNegative?: boolean
}

type TimelineSvgDataItem = VueUiXyDatasetLineItem & {
  source: TimelineSourceItem[]
  plots: TimelinePlotItem[]
}

type TimelineDatasetItem =
  | VueUiXyDatasetLineItem
  | VueUiXyDatasetBarItem
  | VueUiXyDatasetPlotItem
  | undefined

function getDatapointPlots(
  item: TimelineDatasetItem,
  predicate: (datapoint: TimelineSourceItem, index: number) => boolean,
  markerKey: string,
  zoomOffset: number,
): TimelineMarkerItem[] {
  if (!item || !Array.isArray(item.source) || !Array.isArray(item.plots)) {
    return []
  }

  const timelineItem = item as TimelineSvgDataItem

  return timelineItem.source.flatMap((datapoint, index) => {
    const plotIndex = index - zoomOffset
    const plot = timelineItem.plots[plotIndex]

    if (plotIndex < 0 || !plot || !predicate(datapoint, index)) {
      return []
    }

    const hasPositive = datapoint.hasPositive === true
    const hasNegative = datapoint.hasNegative === true

    return [
      {
        key: `${datapoint.version ?? index}-${markerKey}`,
        index,
        x: plot.x,
        y: plot.y,
        offsetY: markerKey === 'negative' && hasPositive && hasNegative ? 20 : 0,
      },
    ]
  })
}

function getActiveVersionDatapointPlot(
  item: TimelineDatasetItem,
  zoomOffset: number,
): TimelinePlotItem | null {
  return item?.plots?.[activeVersionIndex.value - zoomOffset] ?? null
}

function getActiveVersionDatapointBar(
  items: VueUiStackbarFormattedDatasetItem[],
  barWidth: number,
): Partial<TimelinePlotItem> | null {
  const activeIndex = activeVersionIndex.value

  return items
    .flatMap(entry => {
      const y = entry.y?.[activeIndex]

      if (y === undefined) {
        return []
      }

      return [
        {
          entry,
          index: activeIndex,
          y: (y ?? 0) - 12,
          x: (entry.x?.[activeIndex] ?? 0) + barWidth / 2,
          rectKey: entry.rectKeys?.[activeIndex],
          height: entry.height?.[activeIndex],
        },
      ]
    })
    .reduce<Partial<TimelinePlotItem> | null>(
      (min, current) => (min === null || current.y! < min.y! ? current : min),
      null,
    )
}

function getPositiveDatapointPlots(
  item: TimelineDatasetItem,
  zoomOffset: number,
): TimelineMarkerItem[] {
  return getDatapointPlots(
    item,
    datapoint => datapoint.hasPositive === true,
    'positive',
    zoomOffset,
  )
}

function getNegativeDatapointPlots(
  item: TimelineDatasetItem,
  zoomOffset: number,
): TimelineMarkerItem[] {
  return getDatapointPlots(
    item,
    datapoint => datapoint.hasNegative === true,
    'negative',
    zoomOffset,
  )
}

const indexSelection = computed(() => {
  if (props.selectedVersion == null) return null
  return orderedConvertedData.value.findIndex(v => v.version === props.selectedVersion)
})

const stackbarConfig = computed<VueUiStackbarConfig>(() => ({
  theme: isDarkMode.value ? 'dark' : '',
  useCssAnimation: false,
  userOptions: {
    useCursorPointer: true,
    buttons: {
      pdf: false,
      labels: false,
      fullscreen: false,
      table: false,
      tooltip: false,
      annotator: !isMobile.value,
      altCopy: true,
    },
    buttonTitles: commonConfig.value.buttonTitles,
    callbacks: {
      img: commonConfig.value.callbacks!.img,
      csv: commonConfig.value.callbacks!.csv,
      svg: commonConfig.value.callbacks!.svg,
      altCopy: args =>
        copyAltTextForTimelineStackbar({
          dataset: args.dataset,
          config: {
            ...args.config,
            packageName: packageName.value,
            versions: versions.value,
            copy,
            $t,
            numberFormatter: bytesFormatter.format,
            maxSegments: DEP_SEGMENT_COUNT + 2, // Adding Other & __self__
          },
        }),
    },
  },
  style: {
    chart: {
      backgroundColor: colors.value.bg,
      color: colors.value.fg,
      height: 300,
      width: 1000,
      padding: { top: 24, right: 0, bottom: 24, left: 12 },
      zoom: { show: false },
      title: {
        text: applyEllipsis(packageName.value, 32),
        fontSize: isMobile.value ? 14 : 18,
        bold: false,
        color: colors.value.fg,
      },
      legend: {
        show: true,
        position: 'bottom',
        color: colors.value.fg,
        backgroundColor: colors.value.bg,
        fontSize: 12,
        selectAllToggle: {
          show: true,
        },
      },
      tooltip: {
        backgroundColor: colors.value.bg,
        color: colors.value.fg,
        borderColor: colors.value.border,
        borderRadius: 6,
        position: tooltipPosition.value,
        offsetX: 24,
      },
      highlighter: {
        color: colors.value.fg,
        opacity: 10,
      },
      bars: {
        gapRatio: 0,
        borderRadius: 2,
        gradient: { show: false },
        totalValues: { show: false },
        dataLabels: { show: false },
      },
      grid: {
        scale: { ticks: 10 },
        x: {
          showAxis: true,
          axisColor: colors.value.border,
          showHorizontalLines: true,
          linesColor: colors.value.border,
          timeLabels: {
            show: true,
            values: versions.value.map(v => applyEllipsis(v, 20)),
            color: colors.value.fgSubtle,
            fontSize: isMobile.value ? 12 : 10,
            rotation: -30,
            modulo: Math.min(32, Math.round(versions.value.length / 2)),
            showOnlyAtModulo: versions.value.length > 32,
            autoRotate: { enable: false },
          },
        },
        y: {
          showAxis: true,
          axisColor: colors.value.border,
          showVerticalLines: false,
          linesColor: colors.value.border,
          axisName: {
            show: true,
            text: metricLabel.value,
            color: colors.value.fgSubtle,
            fontSize: isMobile.value ? 24 : 14,
          },
          axisLabels: {
            show: true,
            color: colors.value.fgSubtle,
            fontSize: isMobile.value ? 18 : 14,
            formatter: ({ value }) => bytesFormatter.format(value ?? 0),
          },
        },
      },
    },
  },
}))

function stackbarTooltipTime(datapoint: VueUiStackbarTooltipDatapoint[]): string | undefined {
  const absoluteIndex = datapoint[0]?.timeLabel?.absoluteIndex
  if (absoluteIndex == null) return undefined
  return orderedConvertedData.value[absoluteIndex]?.time
}

const timelineMetricTabs = computed(() => [
  {
    value: 'totalSize' as const,
    icon: 'i-lucide:package-open' as const,
    label: $t('package.stats.install_size'),
  },
  {
    value: 'dependencyCount' as const,
    icon: 'i-lucide:network' as const,
    label: $t('compare.dependencies'),
  },
  {
    value: 'dependencySize' as const,
    icon: 'i-lucide:chart-column-stacked' as const,
    label: $t('package.timeline.chart.dependency_size'),
  },
])
</script>

<template>
  <div
    style="width: 100%"
    class="font-mono border-b border-border"
    :class="{ loaded: shouldPauseChartAnimations }"
    id="timeline-chart"
  >
    <div class="mt-4 flex flex-row flex-wrap items-center justify-between gap-4">
      <div class="w-full sm:w-auto">
        <label for="timeline-chart-metric" class="sr-only">
          {{ $t('package.timeline.chart.tab_aria_label') }}
        </label>

        <select
          id="timeline-chart-metric"
          v-model="activeTab"
          class="block w-fit rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg sm:hidden"
        >
          <option v-for="tab in timelineMetricTabs" :key="tab.value" :value="tab.value">
            {{ tab.label }}
          </option>
        </select>

        <div class="hidden sm:block">
          <TabRoot v-model="activeTab" default-value="totalSize">
            <TabList :ariaLabel="$t('package.timeline.chart.tab_aria_label')">
              <TabItem
                v-for="tab in timelineMetricTabs"
                :key="tab.value"
                :value="tab.value"
                :icon="tab.icon"
                :controls-panel="false"
              >
                {{ tab.label }}
              </TabItem>
            </TabList>
          </TabRoot>
        </div>
      </div>

      <div class="flex flex-row flex-wrap gap-4">
        <SettingsToggle
          v-model="settings.timelineChart.isOrdered"
          :label="$t('package.timeline.chart.ordered_versions')"
        />
        <template v-if="activeTab === 'totalSize' || activeTab === 'dependencyCount'">
          <SettingsToggle
            v-model="settings.timelineChart.isZeroBased"
            :label="$t('package.timeline.chart.base_scale')"
          />
          <SettingsToggle
            v-model="settings.timelineChart.showZoom"
            :label="$t('package.timeline.chart.zoom')"
          />
        </template>
      </div>
    </div>
    <ClientOnly>
      <VueUiXy
        v-if="activeTab === 'totalSize' || activeTab === 'dependencyCount'"
        ref="chartRef"
        :dataset="datasets[activeTab]"
        :config
        :selected-x-index="indexSelection"
      >
        <!-- Custom tooltip -->
        <template #tooltip="{ timeLabel }">
          <TimelineChartXyTooltip
            :timeLabel
            :version="orderedConvertedData[timeLabel.absoluteIndex]?.version"
            :tags="orderedConvertedData[timeLabel.absoluteIndex]?.tags"
            :datetime="orderedConvertedData[timeLabel.absoluteIndex]?.time!"
            :activeTab
            :totalSize="
              bytesFormatter.format(orderedConvertedData[timeLabel.absoluteIndex]?.totalSize ?? 0)
            "
            :dependencyCount="
              compactNumberFormatter.format(
                orderedConvertedData[timeLabel.absoluteIndex]?.dependencyCount ?? 0,
              )
            "
            :events="orderedConvertedData[timeLabel.absoluteIndex]?.events"
          />
        </template>

        <!-- Keyboard navigation hint -->
        <template #hint="{ isVisible }">
          <p
            v-if="isVisible"
            class="text-accent text-xs -mt-6 force-text-left px-2"
            aria-hidden="true"
          >
            {{ $t('compare.packages.line_chart_nav_hint') }}
          </p>
        </template>

        <!-- Injecting custom svg elements -->
        <template #svg="{ svg }">
          <TimelineChartXySvgSlot
            :svg
            :activeVersionPlot="getActiveVersionDatapointPlot(svg.data[0], svg.slicer.start)"
            :watermark="
              drawSmallNpmxLogoAndTaglineWatermark({
                svg,
                colors: watermarkColors,
                translateFn: $t,
              })
            "
            :markersPositive="getPositiveDatapointPlots(svg.data[0], svg.slicer.start)"
            :markersNegative="getNegativeDatapointPlots(svg.data[0], svg.slicer.start)"
            :colors
            :gradientColors="E18E_GRADIENT_COLORS"
            :pauseAnimations="shouldPauseChartAnimations"
          />
        </template>

        <template #menuIcon="{ isOpen }">
          <span v-if="isOpen" class="i-lucide:x w-6 h-6" aria-hidden="true" />
          <span v-else class="i-lucide:ellipsis-vertical w-6 h-6" aria-hidden="true" />
        </template>
        <template #optionCsv>
          <span class="text-fg-subtle font-mono pointer-events-none">CSV</span>
        </template>
        <template #optionImg>
          <span class="text-fg-subtle font-mono pointer-events-none">PNG</span>
        </template>
        <template #optionSvg>
          <span class="text-fg-subtle font-mono pointer-events-none">SVG</span>
        </template>
        <template #optionStack="{ isStack }">
          <span
            v-if="isStack"
            class="i-lucide:layers-2 text-fg-subtle w-6 h-6 pointer-events-none"
            aria-hidden="true"
          />
          <span
            v-else
            class="i-lucide:chart-line text-fg-subtle w-6 h-6 pointer-events-none"
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

        <!-- Custom minimap reset button -->
        <template #reset-action="{ reset: resetMinimap }">
          <button
            type="button"
            :aria-label="$t('package.timeline.chart.reset_minimap')"
            class="absolute inset-is-1/2 -translate-x-1/2 -bottom-18 sm:inset-is-unset sm:translate-x-0 sm:bottom-auto sm:-inset-ie-20 sm:-top-3 flex items-center justify-center px-2.5 py-1.75 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-accent/70 sm:mb-0"
            style="pointer-events: all !important"
            @click="resetMinimap"
          >
            <span class="i-lucide:undo-2 w-5 h-5" aria-hidden="true" />
          </button>
        </template>
      </VueUiXy>

      <VueUiStackbar
        v-else
        :dataset="datasets.dependencySize"
        :config="stackbarConfig"
        :selected-x-index="indexSelection"
        ref="chartRef"
      >
        <!-- Injecting custom svg elements -->
        <template #svg="{ svg }">
          <TimelineChartDepSizeSvgSlot
            :svg
            :watermark="
              drawSmallNpmxLogoAndTaglineWatermark({
                svg: {
                  ...svg,
                  height: 12 /** mocking a small height to place the watermark at the top */,
                },
                colors: watermarkColors,
                translateFn: $t,
              })
            "
            :activeVersionPlot="getActiveVersionDatapointBar(svg.data, svg.barWidth)"
            :colors
            :pauseAnimations="shouldPauseChartAnimations"
          />
        </template>

        <!-- Custom tooltip -->
        <template #tooltip="{ datapoint, timeLabel, seriesIndex }">
          <TimelineChartDepSizeTooltip
            :datapoint
            :timeLabel
            :datetime="stackbarTooltipTime(datapoint)!"
            :datapoints="stackbarTooltipPoints(datapoint, seriesIndex)"
          />
        </template>

        <template #menuIcon="{ isOpen }">
          <span v-if="isOpen" class="i-lucide:x w-6 h-6" aria-hidden="true" />
          <span v-else class="i-lucide:ellipsis-vertical w-6 h-6" aria-hidden="true" />
        </template>
        <template #optionCsv>
          <span class="text-fg-subtle font-mono pointer-events-none">CSV</span>
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
      </VueUiStackbar>

      <template #fallback>
        <SkeletonBlock class="flex place-items-center justify-center aspect-[1152/254.59]">
          <span class="i-lucide:chart-line w-10 h-10 text-fg-muted" aria-hidden="true" />
        </SkeletonBlock>
      </template>

      <!-- Sizes loading indicator -->
      <div v-if="loading" class="h-0.5 rounded-full bg-bg-muted overflow-hidden">
        <div class="h-full w-1/3 bg-accent rounded-full animate-indeterminate" />
      </div>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.vue-data-ui-component) {
  --super-ease-out: cubic-bezier(0.15, 0.75, 0.35, 1);
}

:deep(.vue-data-ui-component svg:focus-visible) {
  outline: 1px solid var(--accent) !important;
  border-radius: 0.1rem;
  outline-offset: 0;
}
:deep(.vue-ui-user-options-button:focus-visible),
:deep(.vue-ui-user-options :first-child:focus-visible) {
  outline: 0.1rem solid var(--accent) !important;
  border-radius: 0.25rem;
}

:deep(.vue-data-ui-component .serie_line_0 path),
:deep(.vdui-shape-circle) {
  transition: all 0.5s var(--super-ease-out) !important;
}

:deep(.vdui-shape-no-transition) {
  transition: none !important;
}

:deep(.vue-ui-stackbar rect) {
  animation: none !important;
  transition: all 0.3s var(--super-ease-out) !important;
}

@media (prefers-reduced-motion: reduce) {
  :deep(.vue-data-ui-component .serie_line_0 path),
  :deep(.vdui-shape-circle),
  :deep(.vue-ui-stackbar rect) {
    transition: none !important;
  }
}

:deep(.vue-ui-pen-and-paper-actions) {
  background: var(--bg-elevated) !important;
}

:deep(.vue-ui-pen-and-paper-action) {
  background: var(--bg-elevated) !important;
  border: none !important;
}

:deep(.vue-ui-pen-and-paper-action:hover) {
  background: var(--bg-elevated) !important;
  box-shadow: none !important;
}

/* Override default placement of the refresh button to have it to the minimap's side */
@media screen and (min-width: 767px) {
  :deep(.vue-data-ui-refresh-button) {
    top: -0.6rem !important;
    left: calc(100% + 4rem) !important;
  }
}

@keyframes indeterminate {
  0% {
    translate: -100%;
  }
  100% {
    translate: 400%;
  }
}

.animate-indeterminate {
  animation: indeterminate 1.5s ease-in-out infinite;
}

.loaded :deep(.vue-data-ui-component .serie_line_0 path),
.loaded :deep(.vdui-shape-circle),
.loaded :deep(.vue-ui-stackbar rect) {
  transition: none !important;
  animation: none !important;
}
</style>
