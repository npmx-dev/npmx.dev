<script setup lang="ts">
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import { type VueUiXyDatasetItem, type VueUiXyConfig } from 'vue-data-ui'
import { useElementSize } from '@vueuse/core'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch, lightenHex } from '~/utils/colors'
import {
  drawSvgPrintLegend,
  drawNpmxLogoAndTaglineWatermark,
} from '~/composables/useChartWatermark'
import TooltipApp from '~/components/Tooltip/App.vue'
import { copyAltTextForVersionsBarChart } from '~/utils/charts'

const props = defineProps<{
  packageName: string
  inModal?: boolean
}>()

const { accentColors, selectedAccentColor } = useAccentColor()
const { copy, copied } = useClipboard()

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)

onMounted(async () => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
})

const { colors } = useCssVariables(
  ['--bg', '--fg', '--bg-subtle', '--bg-elevated', '--fg-subtle', '--border', '--border-subtle'],
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

const watermarkColors = computed(() => ({
  fg: colors.value.fg ?? OKLCH_NEUTRAL_FALLBACK,
  bg: colors.value.bg ?? OKLCH_NEUTRAL_FALLBACK,
  fgSubtle: colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK,
}))

const { width } = useElementSize(rootEl)
const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

const {
  groupingMode,
  showRecentOnly,
  showLowUsageVersions,
  pending,
  error,
  chartDataset,
  hasData,
} = useVersionDistribution(() => props.packageName)

const compactNumberFormatter = useCompactNumberFormatter()

// Show loading indicator immediately to maintain stable layout
const showLoadingIndicator = computed(() => pending.value)

const loadFile = (link: string, filename: string) => {
  const a = document.createElement('a')
  a.href = link
  a.download = filename
  a.click()
  a.remove()
}

const sanitise = (value: string) =>
  value
    .replace(/^@/, '')
    .replace(/[\\/:"*?<>|]/g, '-')
    .replace(/\//g, '-')

const { locale } = useI18n()
function formatDate(date: Date) {
  return date.toLocaleString(locale.value, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

const endDate = computed(() => {
  const t = new Date()
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate() - 1))
})

const startDate = computed(() => {
  const start = new Date(endDate.value)
  start.setUTCDate(start.getUTCDate() - 6)
  return start
})

const { t } = useI18n()
const dateRangeLabel = computed(() => {
  const from = formatDate(startDate.value)
  const to = formatDate(endDate.value)
  const endYear = endDate.value.getUTCFullYear()
  const startYear = startDate.value.getUTCFullYear()

  if (startYear !== endYear) {
    return t('package.versions.distribution_range_date_multiple_years', {
      from,
      to,
      startYear,
      endYear,
    })
  }

  return t('package.versions.distribution_range_date_same_year', { from, to, endYear })
})

function buildExportFilename(extension: string): string {
  const range = dateRangeLabel.value.replaceAll(' ', '_').replaceAll(',', '')

  const label = props.packageName
  return `${sanitise(label ?? '')}_${range}.${extension}`
}

// VueUiXy expects one series with multiple values for bar charts
const xyDataset = computed<VueUiXyDatasetItem[]>(() => {
  if (!chartDataset.value.length) return []

  return [
    {
      name: props.packageName,
      series: chartDataset.value.map(item => item.downloads),
      type: 'bar' as const,
      color: accent.value,
    },
  ]
})

const xAxisLabels = computed(() => {
  return chartDataset.value.map(item => item.name)
})

const hasMinimap = computed<boolean>(() => {
  const series = xyDataset.value[0]?.series ?? []
  return series.length > 6
})

const chartConfig = computed<VueUiXyConfig>(() => {
  return {
    theme: isDarkMode.value ? 'dark' : '',
    chart: {
      title: {
        text: dateRangeLabel.value,
        fontSize: isMobile.value ? 24 : 16,
        bold: false,
      },
      height: isMobile.value ? 750 : hasMinimap.value ? 500 : 611,
      backgroundColor: colors.value.bg,
      padding: {
        top: 24,
        right: 24,
        bottom: 60,
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
          csv: $t('package.trends.download_file', { fileType: 'CSV' }),
          img: $t('package.trends.download_file', { fileType: 'PNG' }),
          svg: $t('package.trends.download_file', { fileType: 'SVG' }),
          annotator: $t('package.trends.toggle_annotator'),
          altCopy: $t('package.trends.copy_alt.button_label'), // Do not make this text dependant on the `copied` variable, since this would re-render the component, which is undesirable if the minimap was used to select a time frame.
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
          altCopy: ({ dataset: dst, config: cfg }) =>
            copyAltTextForVersionsBarChart({
              dataset: dst,
              config: {
                ...cfg,
                datapointLabels: xAxisLabels.value,
                dateRangeLabel: dateRangeLabel.value,
                semverGroupingMode: groupingMode.value,
                copy,
                $t,
                numberFormatter: compactNumberFormatter.value.format,
              },
            }),
        },
      },
      grid: {
        stroke: colors.value.border,
        showHorizontalLines: true,
        labels: {
          fontSize: isMobile.value ? 24 : 16,
          color: pending.value ? colors.value.border : colors.value.fgSubtle,
          axis: {
            yLabel: $t('package.versions.y_axis_label'),
            yLabelOffsetX: 12,
            fontSize: isMobile.value ? 32 : 24,
          },
          yAxis: {
            formatter: ({ value }: { value: number }) => {
              return compactNumberFormatter.value.format(Number.isFinite(value) ? value : 0)
            },
            useNiceScale: true,
          },
          xAxisLabels: {
            show: xAxisLabels.value.length <= 25,
            values: xAxisLabels.value,
            fontSize: 16,
            color: colors.value.fgSubtle,
          },
        },
      },
      highlighter: { useLine: false },
      legend: { show: false, position: 'top' },
      bar: {
        periodGap: 16,
        innerGap: 8,
        borderRadius: 4,
      },
      tooltip: {
        teleportTo: props.inModal ? '#chart-modal' : undefined,
        borderColor: 'transparent',
        backdropFilter: false,
        backgroundColor: 'transparent',
        customFormat: ({ datapoint, absoluteIndex, bars }) => {
          if (!datapoint || pending.value) return ''

          // Use absoluteIndex to get the correct version from chartDataset
          const index = Number(absoluteIndex)
          if (!Number.isInteger(index) || index < 0 || index >= chartDataset.value.length) return ''
          const chartItem = chartDataset.value[index]

          if (!chartItem) return ''

          const barSeries = Array.isArray(bars?.[0]?.series) ? bars[0].series : []
          const barValue = index < barSeries.length ? barSeries[index] : undefined
          const raw = Number(barValue ?? chartItem.downloads ?? 0)
          const v = compactNumberFormatter.value.format(Number.isFinite(raw) ? raw : 0)

          return `<div class="font-mono text-xs p-3 border border-border rounded-md bg-[var(--bg)]/10 backdrop-blur-md">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-4">
                <span class="text-3xs tracking-wide text-[var(--fg)]/70">
                  ${chartItem.name}
                </span>
                <span class="text-base text-[var(--fg)] font-mono tabular-nums">
                  ${v}
                </span>
              </div>
            </div>
          </div>`
        },
      },
      zoom: {
        maxWidth: isMobile.value ? 350 : 500,
        highlightColor: colors.value.bgElevated,
        useResetSlot: true,
        minimap: {
          show: true,
          lineColor: '#FAFAFA',
          selectedColor: accent.value,
          selectedColorOpacity: 0.06,
          frameColor: colors.value.border,
          handleWidth: isMobile.value ? 40 : 20, // does not affect the size of the touch area
          handleBorderColor: colors.value.fgSubtle,
          handleType: 'grab', // 'empty' | 'chevron' | 'arrow' | 'grab'
        },
        preview: {
          fill: transparentizeOklch(accent.value, isDarkMode.value ? 0.95 : 0.92),
          stroke: transparentizeOklch(accent.value, 0.5),
          strokeWidth: 1,
          strokeDasharray: 3,
        },
      },
    },
  }
})
</script>

<template>
  <div
    class="w-full flex flex-col"
    id="version-distribution"
    :aria-busy="pending ? 'true' : 'false'"
  >
    <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end mb-6">
      <div class="flex flex-col gap-1">
        <label class="text-3xs font-mono text-fg-subtle tracking-wide uppercase">
          {{ $t('package.versions.distribution_title') }}
        </label>

        <ButtonGroup>
          <ButtonBase
            @click="groupingMode = 'major'"
            :variant="groupingMode === 'major' ? 'primary' : 'secondary'"
          >
            {{ $t('package.versions.grouping_major') }}
          </ButtonBase>

          <ButtonBase
            @click="groupingMode = 'minor'"
            :variant="groupingMode === 'minor' ? 'primary' : 'secondary'"
          >
            {{ $t('package.versions.grouping_minor') }}
          </ButtonBase>
        </ButtonGroup>
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="text-3xs font-mono text-fg-subtle tracking-wide uppercase flex items-center gap-2"
        >
          <span>{{ $t('package.versions.grouping_versions_title') }}</span>
          <TooltipApp
            :text="$t('package.versions.recent_versions_only_tooltip')"
            interactive
            position="top"
            :to="inModal ? '#chart-modal' : undefined"
            :offset="8"
          >
            <span
              tabindex="0"
              class="i-lucide:info w-3.5 h-3.5 text-fg-subtle cursor-help shrink-0 rounded-sm"
              role="img"
              aria-label="versions info"
            />
          </TooltipApp>
        </label>

        <ButtonGroup>
          <ButtonBase
            @click="showRecentOnly = false"
            :variant="showRecentOnly ? 'secondary' : 'primary'"
          >
            {{ $t('package.versions.grouping_versions_all') }}
          </ButtonBase>
          <ButtonBase
            @click="showRecentOnly = true"
            :variant="showRecentOnly ? 'primary' : 'secondary'"
          >
            {{ $t('package.versions.grouping_versions_only_recent') }}
          </ButtonBase>
        </ButtonGroup>
      </div>

      <div class="flex flex-col gap-1">
        <label
          class="text-3xs font-mono text-fg-subtle tracking-wide uppercase flex items-center gap-2"
        >
          <span>{{ $t('package.versions.grouping_usage_title') }}</span>
          <TooltipApp
            :text="$t('package.versions.show_low_usage_tooltip')"
            interactive
            position="top"
            :to="inModal ? '#chart-modal' : undefined"
            :offset="8"
          >
            <span
              tabindex="0"
              class="i-lucide:info w-3.5 h-3.5 text-fg-subtle cursor-help shrink-0 rounded-sm"
              role="img"
              aria-label="versions info"
            />
          </TooltipApp>
        </label>
        <ButtonGroup>
          <ButtonBase
            @click="showLowUsageVersions = false"
            :variant="showLowUsageVersions ? 'secondary' : 'primary'"
          >
            {{ $t('package.versions.grouping_usage_all') }}
          </ButtonBase>
          <ButtonBase
            @click="showLowUsageVersions = true"
            :variant="showLowUsageVersions ? 'primary' : 'secondary'"
          >
            {{ $t('package.versions.grouping_usage_low') }}
          </ButtonBase>
        </ButtonGroup>
      </div>
    </div>

    <h2 id="version-distribution-title" class="sr-only">
      {{ $t('package.versions.distribution_title') }}
    </h2>

    <div
      role="region"
      aria-labelledby="version-distribution-title"
      class="relative"
      :class="isMobile ? 'min-h-[260px]' : 'min-h-[520px]'"
    >
      <!-- Chart content -->
      <ClientOnly v-if="xyDataset.length > 0 && !error">
        <div class="chart-container w-full" :key="groupingMode">
          <VueUiXy :dataset="xyDataset" :config="chartConfig" class="[direction:ltr]">
            <!-- Injecting custom svg elements -->
            <template #svg="{ svg }">
              <!-- Inject legend during SVG print only -->
              <g v-if="svg.isPrintingSvg" v-html="drawSvgPrintLegend(svg, watermarkColors)" />

              <!-- Inject npmx logo & tagline during SVG and PNG print -->
              <g
                v-if="svg.isPrintingSvg || svg.isPrintingImg"
                v-html="drawNpmxLogoAndTaglineWatermark(svg, watermarkColors, $t, 'bottom')"
              />

              <!-- Overlay covering the chart area to hide line resizing when switching granularities recalculates VueUiXy scaleMax when estimation lines are necessary -->
              <rect
                v-if="pending"
                :x="svg.drawingArea.left"
                :y="svg.drawingArea.top - 12"
                :width="svg.drawingArea.width + 12"
                :height="svg.drawingArea.height + 48"
                :fill="colors.bg"
              />
            </template>

            <!-- Custom bar gradient based on the series color -->
            <template #bar-gradient="{ series, positiveId }">
              <linearGradient :id="positiveId" x1="0" x2="0" y1="0" y2="1">
                <!-- vue-data-ui exposes hex-normalized colors -->
                <stop offset="0%" :stop-color="lightenHex(series.color, 0.618)" />
                <stop offset="100%" :stop-color="series.color" stop-opacity="0.618" />
              </linearGradient>
            </template>

            <!-- Custom legend for single series (non-interactive) -->
            <template #legend="{ legend }">
              <div class="flex gap-4 flex-wrap justify-center pt-8">
                <template v-if="legend.length > 0">
                  <div class="flex gap-1 place-items-center">
                    <div class="h-3 w-3">
                      <svg viewBox="0 0 2 2" class="w-full">
                        <rect x="0" y="0" width="2" height="2" rx="0.3" :fill="legend[0]?.color" />
                      </svg>
                    </div>
                    <span>
                      {{ legend[0]?.name }}
                    </span>
                  </div>
                </template>
              </div>
            </template>

            <!-- Custom minimap reset button -->
            <template #reset-action="{ reset: resetMinimap }">
              <button
                type="button"
                aria-label="reset minimap"
                class="absolute inset-is-1/2 -translate-x-1/2 -bottom-18 sm:inset-is-unset sm:translate-x-0 sm:bottom-auto sm:-inset-ie-20 sm:-top-3 flex items-center justify-center px-2.5 py-1.75 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-accent/70 sm:mb-0"
                style="pointer-events: all !important"
                @click="resetMinimap"
              >
                <span class="i-lucide:undo-2 w-5 h-5" aria-hidden="true" />
              </button>
            </template>

            <!-- Contextual menu icon -->
            <template #menuIcon="{ isOpen }">
              <span v-if="isOpen" class="i-lucide:x w-6 h-6" aria-hidden="true" />
              <span v-else class="i-lucide:ellipsis-vertical w-6 h-6" aria-hidden="true" />
            </template>

            <!-- Export options -->
            <template #optionCsv>
              <span class="text-fg-subtle font-mono pointer-events-none">CSV</span>
            </template>
            <template #optionImg>
              <span class="text-fg-subtle font-mono pointer-events-none">PNG</span>
            </template>
            <template #optionSvg>
              <span class="text-fg-subtle font-mono pointer-events-none">SVG</span>
            </template>

            <!-- Annotator action icons -->
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
          </VueUiXy>
        </div>

        <template #fallback>
          <div />
        </template>
      </ClientOnly>

      <!-- No-data state -->
      <div v-if="!hasData && !pending && !error" class="flex items-center justify-center h-full">
        <div class="text-sm text-fg-subtle font-mono text-center flex flex-col items-center gap-2">
          <span class="i-lucide:database w-8 h-8" />
          <p>{{ $t('package.trends.no_data') }}</p>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="error" class="flex items-center justify-center h-full" role="alert">
        <div class="text-sm text-fg-subtle font-mono text-center flex flex-col items-center gap-2">
          <span class="i-lucide:octagon-alert w-8 h-8 text-red-400" />
          <p>{{ error.message }}</p>
          <p class="text-xs">Package: {{ packageName }}</p>
        </div>
      </div>

      <!-- Loading indicator as true overlay -->
      <div
        v-if="showLoadingIndicator"
        role="status"
        aria-live="polite"
        class="absolute top-1/2 inset-is-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div
          class="text-xs text-fg-subtle font-mono bg-bg/70 backdrop-blur px-3 py-2 rounded-md border border-border"
        >
          {{ $t('common.loading') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Disable all transitions on SVG elements to prevent repositioning animation */
:deep(.vue-ui-xy) svg rect {
  transition: none !important;
}
</style>

<style>
/* Override default placement of the refresh button to have it to the minimap's side */
@media screen and (min-width: 767px) {
  #version-distribution .vue-data-ui-refresh-button {
    top: -0.6rem !important;
    left: calc(100% + 4rem) !important;
  }
}

/* Adds padding to graph title in absence of a configurable css property */
#version-distribution .atom-title {
  padding-top: 20px;
}
</style>
