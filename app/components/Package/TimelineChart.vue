<script setup lang="ts">
import { onMounted } from 'vue'
import {
  VueUiXy,
  type VueUiXyConfig,
  type VueUiXyDatasetBarItem,
  type VueUiXyDatasetItem,
  type VueUiXyDatasetLineItem,
  type VueUiXyDatasetPlotItem,
} from 'vue-data-ui/vue-ui-xy'
import {
  sanitise,
  loadFile,
  applyEllipsis,
  copyAltTextForTimelineChart,
  type EnrichedTimelineSizeCacheEntry,
  type TimelineSizeCacheValue,
} from '~/utils/charts'
import type { TimelineVersion, SubEvent } from '~~/server/api/registry/timeline/[...pkg].get'
import { drawSmallNpmxLogoAndTaglineWatermark } from '~/composables/useChartWatermark'

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

watch(
  convertedData,
  async () => {
    await nextTick()
    chartRef.value?.resetZoom()
  },
  { flush: 'post' },
)

const versions = computed(() => convertedData.value.map(d => d.version))

const activeVersionIndex = computed(() => {
  if (!activeVersion.value) return -1
  return versions.value.findIndex(v => v === activeVersion.value)
})

const seriesTotalSize = computed(() => {
  const values = convertedData.value.map(d => d.totalSize)
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
  const values = convertedData.value.map(d => d.dependencyCount)
  if (!values.length) {
    return { values, min: 0, max: 0 }
  }
  return {
    values,
    min: Math.min(...values),
    max: Math.max(...values),
  }
})

type ActiveTab = 'totalSize' | 'dependencyCount'
const activeTab = shallowRef<ActiveTab>('totalSize')

const e18eGradientColors = [
  'oklch(73.76% 0.130 47.72)',
  'oklch(85.35% 0.132 88.65)',
  'oklch(81.56% 0.145 116.12)',
  'oklch(71.29% 0.132 136.26)',
]

function areAllValuesEqual(array: number[]): boolean {
  if (array.length <= 1) return true
  return array.every(value => value === array[0])
}

const datasets = computed<{
  totalSize: VueUiXyDatasetItem[]
  dependencyCount: VueUiXyDatasetItem[]
}>(() => {
  return {
    totalSize: [
      {
        name: $t('package.stats.install_size'),
        type: 'line',
        smooth: true,
        series: seriesTotalSize.value.values,
        temperatureColors: areAllValuesEqual(seriesTotalSize.value.values)
          ? undefined
          : e18eGradientColors,
        color: colors.value.fgSubtle,
        source: convertedData.value,
      },
    ],
    dependencyCount: [
      {
        name: $t('compare.dependencies'),
        type: 'line',
        smooth: true,
        series: seriesDependencies.value.values,
        temperatureColors: areAllValuesEqual(seriesDependencies.value.values)
          ? undefined
          : e18eGradientColors,
        color: colors.value.fgSubtle,
        source: convertedData.value,
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
  activeTab.value === 'totalSize' ? bytesFormatter : intFormatter.value,
)

onMounted(async () => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
})

const { colors } = useCssVariables(
  [
    '--bg',
    '--fg',
    '--bg-subtle',
    '--bg-elevated',
    '--fg-subtle',
    '--fg-muted',
    '--border',
    '--border-subtle',
    '--accent',
  ],
  {
    element: rootEl,
    watchHtmlAttributes: true,
    watchResize: false,
  },
)

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

const metricLabel = computed(() =>
  activeTab.value === 'totalSize' ? $t('package.stats.install_size') : $t('compare.dependencies'),
)

function buildExportFilename(extension: 'png' | 'csv' | 'svg') {
  return `${sanitise(packageName.value)}_${$t('package.links.timeline')}_${metricLabel.value.toLocaleLowerCase().replaceAll(' ', '-')}.${extension}`
}

const config = computed<VueUiXyConfig>(() => {
  return {
    theme: isDarkMode.value ? 'dark' : '',
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
            modulo: 24,
            showOnlyAtModulo: versions.value.length > 24,
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
        callbacks: {
          img: args => {
            const imageUri = args?.imageUri
            if (!imageUri) return
            loadFile(imageUri, buildExportFilename('png'))
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
            loadFile(url, buildExportFilename('csv'))
            URL.revokeObjectURL(url)
          },
          svg: args => {
            const blob = args?.blob
            if (!blob) return
            const url = URL.createObjectURL(blob)
            loadFile(url, buildExportFilename('svg'))
            URL.revokeObjectURL(url)
          },
          altCopy: () =>
            copyAltTextForTimelineChart({
              dataset: convertedData.value,
              config: {
                packageName: packageName.value,
                metric: activeTab.value,
                copy,
                $t,
                numberFormatter: formatter.value.format,
              },
            }),
        },
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

type TimelinePlotItem = {
  x: number
  y: number
  value?: number
}

type TimelineMarkerItem = TimelinePlotItem & {
  key: string
  offsetY?: number
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
  return convertedData.value.findIndex(v => v.version === props.selectedVersion)
})
</script>

<template>
  <div style="width: 100%" class="font-mono border-b border-border" id="timeline-chart">
    <div class="mt-4 flex flex-row flex-wrap items-center justify-between gap-4">
      <TabRoot v-model="activeTab" default-value="totalSize">
        <TabList :ariaLabel="$t('package.timeline.chart.tab_aria_label')">
          <TabItem value="totalSize" icon="i-lucide:package-open" :controls-panel="false">
            {{ $t('package.stats.install_size') }}
          </TabItem>
          <TabItem value="dependencyCount" icon="i-lucide:network" :controls-panel="false">
            {{ $t('compare.dependencies') }}
          </TabItem>
        </TabList>
      </TabRoot>

      <div class="flex flex-row flex-wrap gap-4">
        <SettingsToggle
          v-model="settings.timelineChart.isZeroBased"
          :label="$t('package.timeline.chart.base_scale')"
        />
        <SettingsToggle
          v-model="settings.timelineChart.showZoom"
          :label="$t('package.timeline.chart.zoom')"
        />
      </div>
    </div>
    <ClientOnly>
      <VueUiXy
        ref="chartRef"
        :dataset="datasets[activeTab]"
        :config
        :selected-x-index="indexSelection"
      >
        <!-- Custom tooltip -->
        <template #tooltip="{ timeLabel }">
          <div class="font-mono text-xs flex flex-col">
            <div class="border-border border-b pb-2 mb-2 flex flex-col">
              <div class="flex flex-row gap-4">
                <span class="text-fg">{{ convertedData[timeLabel.absoluteIndex]?.version }}</span>
                <span
                  v-for="tag in convertedData[timeLabel.absoluteIndex]?.tags"
                  :key="tag"
                  class="text-3xs font-semibold uppercase tracking-wide"
                  :class="tag === 'latest' ? 'text-accent' : 'text-fg-subtle'"
                >
                  {{ tag }}
                </span>
              </div>
              <DateTime
                :datetime="convertedData[timeLabel.absoluteIndex]?.time!"
                class="text-xs text-fg-subtle"
                year="numeric"
                month="short"
                day="numeric"
              />
            </div>

            <div :class="activeTab === 'totalSize' ? 'flex flex-col' : 'flex flex-col-reverse'">
              <!-- Install size -->
              <div class="flex flex-row gap-2 items-end">
                <span class="text-[var(--fg)]/70">{{ $t('package.stats.install_size') }}</span>
                <span class="text-sm">
                  {{
                    bytesFormatter.format(convertedData[timeLabel.absoluteIndex]?.totalSize ?? 0)
                  }}
                </span>
              </div>

              <!-- Dependency count -->
              <div class="flex flex-row gap-2 items-end">
                <span class="text-[var(--fg)]/70">{{ $t('compare.dependencies') }}</span>
                <span class="text-sm">
                  {{
                    compactNumberFormatter.format(
                      convertedData[timeLabel.absoluteIndex]?.dependencyCount ?? 0,
                    )
                  }}
                </span>
              </div>
            </div>

            <!-- Positive & negative events -->
            <ol
              v-if="convertedData[timeLabel.absoluteIndex]?.events.length"
              class="relative font-[Geist] mt-2"
            >
              <li
                v-for="event in convertedData[timeLabel.absoluteIndex]?.events"
                :key="event.key"
                class="relative mb-1 ms-4 last:mb-0"
              >
                <span
                  class="absolute -start-[1rem] top-0.5 flex items-center justify-center w-3 h-3 rounded-full border"
                  :class="
                    event.positive
                      ? 'bg-green-500 border-green-600'
                      : 'bg-amber-500 border-amber-600'
                  "
                >
                  <span class="w-2 h-2 text-white" :class="event.icon" aria-hidden="true" />
                </span>
                <p
                  class="text-xs"
                  :class="
                    event.positive
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-amber-700 dark:text-amber-400'
                  "
                >
                  {{ event.text }}
                </p>
              </li>
            </ol>
          </div>
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
          <!-- Print watermark-->
          <g
            v-if="svg.isPrintingSvg || svg.isPrintingImg"
            v-html="
              drawSmallNpmxLogoAndTaglineWatermark({
                svg,
                colors: watermarkColors,
                translateFn: $t,
              })
            "
          />

          <g class="pointer-events-none">
            <!-- Marker for selected version -->
            <circle
              class="pointer-events-none svg-element-transition"
              v-if="getActiveVersionDatapointPlot(svg.data[0], svg.slicer.start)"
              :cx="getActiveVersionDatapointPlot(svg.data[0], svg.slicer.start)!.x"
              :cy="getActiveVersionDatapointPlot(svg.data[0], svg.slicer.start)!.y"
              r="8"
              :fill="colors.accent"
              :stroke="colors.bg"
              stroke-width="2"
            />

            <!-- Marker for positive events -->
            <g
              v-for="plot in getPositiveDatapointPlots(svg.data[0], svg.slicer.start)"
              :key="plot.key"
              class="pointer-events-none"
            >
              <path
                :d="`M ${plot.x - 5} ${plot.y - 20} l 4 6 l 10 -12`"
                fill="none"
                :stroke="colors.bg"
                stroke-width="6"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="svg-element-transition"
              />
              <path
                :d="`M ${plot.x - 5} ${plot.y - 20} l 4 6 l 10 -12`"
                fill="none"
                :stroke="e18eGradientColors.at(-1)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="svg-element-transition"
              />
            </g>

            <!-- Marker for negative events -->
            <g
              v-for="plot in getNegativeDatapointPlots(svg.data[0], svg.slicer.start)"
              :key="plot.key"
              class="pointer-events-none"
            >
              <path
                :d="`M ${plot.x - 1} ${plot.y - 20 - (plot.offsetY ?? 0)} l -6 10 l 12 0 l -6 -10 m 0 5 l 0 2`"
                fill="none"
                :stroke="colors.bg"
                stroke-width="6"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="svg-element-transition"
              />
              <path
                :d="`M ${plot.x - 1} ${plot.y - 20 - (plot.offsetY ?? 0)} l -6 10 l 12 0 l -6 -10 m 0 5 l 0 2`"
                fill="none"
                :stroke="e18eGradientColors[0]"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="svg-element-transition"
              />
            </g>
          </g>
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

        <template #annotator-action-close>
          <span
            class="i-lucide:x w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
            aria-hidden="true"
          />
        </template>
        <template #annotator-action-color="{ color }">
          <span class="i-lucide:palette w-6 h-6" :style="{ color }" aria-hidden="true" />
        </template>
        <template #annotator-action-draw="{ mode }">
          <span
            v-if="mode === 'arrow'"
            class="i-lucide:move-up-right text-fg-subtle w-6 h-6"
            aria-hidden="true"
          />
          <span
            v-if="mode === 'text'"
            class="i-lucide:type text-fg-subtle w-6 h-6"
            aria-hidden="true"
          />
          <span
            v-if="mode === 'line'"
            class="i-lucide:pen-line text-fg-subtle w-6 h-6"
            aria-hidden="true"
          />
          <span
            v-if="mode === 'draw'"
            class="i-lucide:line-squiggle text-fg-subtle w-6 h-6"
            aria-hidden="true"
          />
        </template>
        <template #annotator-action-undo>
          <span
            class="i-lucide:undo-2 w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
            aria-hidden="true"
          />
        </template>
        <template #annotator-action-redo>
          <span
            class="i-lucide:redo-2 w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
            aria-hidden="true"
          />
        </template>
        <template #annotator-action-delete>
          <span
            class="i-lucide:trash w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
            aria-hidden="true"
          />
        </template>
        <template #optionAnnotator="{ isAnnotator }">
          <span
            v-if="isAnnotator"
            class="i-lucide:pen-off w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
            aria-hidden="true"
          />
          <span
            v-else
            class="i-lucide:pen w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
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
.svg-element-transition,
:deep(.vdui-shape-circle) {
  transition: all 0.5s var(--super-ease-out) !important;
}

@media (prefers-reduced-motion: reduce) {
  ::deep(.vue-data-ui-component .serie_line_0 path),
  .svg-element-transition,
  :deep(.vdui-shape-circle) {
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
</style>
