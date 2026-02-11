<script setup lang="ts">
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import type {
  VueUiXyDatasetItem,
  VueUiXyDatasetBarItem,
  VueUiXyDatapointItem,
  MinimalCustomFormatParams,
} from 'vue-data-ui'
import { useElementSize } from '@vueuse/core'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch } from '~/utils/colors'
import {
  drawSvgPrintLegend,
  drawNpmxLogoAndTaglineWatermark,
} from '~/composables/useChartWatermark'
import TooltipApp from '~/components/Tooltip/App.vue'

type TooltipParams = MinimalCustomFormatParams<VueUiXyDatapointItem[]> & {
  bars: VueUiXyDatasetBarItem[]
}

const props = defineProps<{
  packageName: string
  inModal?: boolean
}>()

const { accentColors, selectedAccentColor } = useAccentColor()
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

function buildExportFilename(extension: string): string {
  const range = `${startDate.value}_${endDate.value}`

  const label = props.packageName
  return `${sanitise(label ?? '')}_${range}.${extension}`
}

const chartConfig = computed(() => {
  return {
    theme: isDarkMode.value ? 'dark' : 'default',
    chart: {
      height: isMobile.value ? 750 : 500,
      backgroundColor: colors.value.bg,
      padding: {
        top: 24,
        right: 24,
        bottom: xAxisLabels.value.length > 10 ? 84 : 72, // Space for rotated labels + watermark
      },
      userOptions: {
        buttons: {
          pdf: false,
          labels: false,
          fullscreen: false,
          table: false,
          tooltip: false,
        },
        buttonTitles: {
          csv: $t('package.trends.download_file', { fileType: 'CSV' }),
          img: $t('package.trends.download_file', { fileType: 'PNG' }),
          svg: $t('package.trends.download_file', { fileType: 'SVG' }),
          annotator: $t('package.trends.toggle_annotator'),
        },
        callbacks: {
          img: ({ imageUri }: { imageUri: string }) => {
            loadFile(imageUri, buildExportFilename('png'))
          },
          csv: (csvStr: string) => {
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
          svg: ({ blob }: { blob: Blob }) => {
            const url = URL.createObjectURL(blob)
            loadFile(url, buildExportFilename('svg'))
            URL.revokeObjectURL(url)
          },
        },
      },
      grid: {
        stroke: colors.value.border,
        showHorizontalLines: true,
        labels: {
          fontSize: isMobile.value ? 24 : 16,
          color: pending.value ? colors.value.border : colors.value.fgSubtle,
          axis: {
            yLabel: 'Downloads',
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
        customFormat: (params: TooltipParams) => {
          const { datapoint, absoluteIndex, bars } = params
          if (!datapoint) return ''

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
        minimap: {
          show: true,
          lineColor: '#FAFAFA',
          selectedColor: accent.value,
          selectedColorOpacity: 0.06,
          frameColor: colors.value.border,
        },
        preview: {
          fill: transparentizeOklch(accent.value, isDarkMode.value ? 0.95 : 0.92),
          stroke: transparentizeOklch(accent.value, 0.5),
          strokeWidth: 1,
          strokeDasharray: 3,
        },
      },
    },
    table: {
      show: false,
    },
  }
})

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

// Handle keyboard navigation for semver group toggle
function handleGroupingKeydown(event: KeyboardEvent) {
  if (pending.value) return
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    // Toggle between major and minor
    groupingMode.value = groupingMode.value === 'major' ? 'minor' : 'major'
  } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    // Arrow keys also toggle
    groupingMode.value = groupingMode.value === 'major' ? 'minor' : 'major'
  }
}

// Calculate last week date range (matches npm's "last-week" API)
const startDate = computed(() => {
  const today = new Date()
  const yesterday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  )
  const startObj = new Date(yesterday)
  startObj.setUTCDate(startObj.getUTCDate() - 6)
  return startObj.toISOString().slice(0, 10)
})

const endDate = computed(() => {
  const today = new Date()
  const yesterday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  )
  return yesterday.toISOString().slice(0, 10)
})
</script>

<template>
  <div
    class="w-full flex flex-col"
    id="version-distribution"
    :aria-busy="pending ? 'true' : 'false'"
  >
    <div class="w-full mb-4 flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
        <div class="flex flex-col gap-1 sm:shrink-0">
          <label class="text-3xs font-mono text-fg-subtle tracking-wide uppercase">
            {{ $t('package.versions.distribution_title') }}
          </label>
          <div
            class="flex items-center bg-bg-subtle border border-border rounded-md"
            role="group"
            :aria-label="$t('package.versions.distribution_title')"
            tabindex="0"
            @keydown="handleGroupingKeydown"
          >
            <button
              type="button"
              :class="[
                'px-4 py-1.75 font-mono text-sm transition-colors rounded-s-md',
                groupingMode === 'major'
                  ? 'bg-accent text-bg font-medium'
                  : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50',
              ]"
              :aria-pressed="groupingMode === 'major'"
              :disabled="pending"
              tabindex="-1"
              @click="groupingMode = 'major'"
            >
              {{ $t('package.versions.grouping_major') }}
            </button>
            <button
              type="button"
              :class="[
                'px-4 py-1.75 font-mono text-sm transition-colors rounded-e-md border-is border-border',
                groupingMode === 'minor'
                  ? 'bg-accent text-bg font-medium'
                  : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50',
              ]"
              :aria-pressed="groupingMode === 'minor'"
              :disabled="pending"
              tabindex="-1"
              @click="groupingMode = 'minor'"
            >
              {{ $t('package.versions.grouping_minor') }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 flex-1">
          <TooltipApp
            :text="$t('package.versions.date_range_tooltip')"
            position="bottom"
            :to="inModal ? '#chart-modal' : undefined"
            :offset="8"
            class="w-full"
          >
            <div class="flex flex-col gap-1 w-full">
              <label
                for="versionDistStartDate"
                class="text-3xs font-mono text-fg-subtle tracking-wide uppercase"
              >
                {{ $t('package.trends.start_date') }}
              </label>
              <div class="relative flex items-center">
                <span
                  class="absolute inset-is-2 i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0 pointer-events-none"
                  aria-hidden="true"
                />
                <InputBase
                  id="versionDistStartDate"
                  :model-value="startDate"
                  disabled
                  type="date"
                  class="w-full min-w-0 bg-transparent ps-7"
                  size="medium"
                />
              </div>
            </div>
          </TooltipApp>

          <TooltipApp
            :text="$t('package.versions.date_range_tooltip')"
            position="bottom"
            :to="inModal ? '#chart-modal' : undefined"
            :offset="8"
            class="w-full"
          >
            <div class="flex flex-col gap-1 w-full">
              <label
                for="versionDistEndDate"
                class="text-3xs font-mono text-fg-subtle tracking-wide uppercase"
              >
                {{ $t('package.trends.end_date') }}
              </label>
              <div class="relative flex items-center">
                <span
                  class="absolute inset-is-2 i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0 pointer-events-none"
                  aria-hidden="true"
                />
                <InputBase
                  id="versionDistEndDate"
                  :model-value="endDate"
                  disabled
                  type="date"
                  class="w-full min-w-0 bg-transparent ps-7"
                  size="medium"
                />
              </div>
            </div>
          </TooltipApp>
        </div>
      </div>

      <div class="flex flex-col gap-4 w-full max-w-1/2">
        <TooltipApp
          :text="$t('package.versions.recent_versions_only_tooltip')"
          position="bottom"
          :to="inModal ? '#chart-modal' : undefined"
          :offset="8"
        >
          <SettingsToggle
            v-model="showRecentOnly"
            :label="$t('package.versions.recent_versions_only')"
            justify="start"
            reverse-order
            :class="pending ? 'opacity-50 pointer-events-none' : ''"
          />
        </TooltipApp>

        <TooltipApp
          :text="$t('package.versions.show_low_usage_tooltip')"
          position="bottom"
          :to="inModal ? '#chart-modal' : undefined"
          :offset="8"
        >
          <SettingsToggle
            v-model="showLowUsageVersions"
            :label="$t('package.versions.show_low_usage')"
            justify="start"
            reverse-order
            :class="pending ? 'opacity-50 pointer-events-none' : ''"
          />
        </TooltipApp>
      </div>
    </div>

    <h2 id="version-distribution-title" class="sr-only">
      {{ $t('package.versions.distribution_title') }}
    </h2>

    <div
      role="region"
      aria-labelledby="version-distribution-title"
      class="relative"
      :class="isMobile ? 'min-h-[260px]' : 'min-h-[400px]'"
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
            </template>

            <!-- Subtle gradient applied for area charts -->
            <template #area-gradient="{ series: chartModalSeries, id: gradientId }">
              <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" :stop-color="chartModalSeries.color" stop-opacity="0.2" />
                <stop offset="100%" :stop-color="colors.bg" stop-opacity="0" />
              </linearGradient>
            </template>

            <!-- Custom legend for single series (non-interactive) -->
            <template #legend="{ legend }">
              <div class="flex gap-4 flex-wrap justify-center">
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

            <!-- Contextual menu icon -->
            <template #menuIcon="{ isOpen }">
              <span v-if="isOpen" class="i-carbon:close w-6 h-6" aria-hidden="true" />
              <span v-else class="i-carbon:overflow-menu-vertical w-6 h-6" aria-hidden="true" />
            </template>

            <!-- Export options -->
            <template #optionCsv>
              <span
                class="i-carbon:csv w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template #optionImg>
              <span
                class="i-carbon:png w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template #optionSvg>
              <span
                class="i-carbon:svg w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <!-- Annotator action icons -->
            <template #annotator-action-close>
              <span
                class="i-carbon:close w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template #annotator-action-color="{ color }">
              <span class="i-carbon:color-palette w-6 h-6" :style="{ color }" aria-hidden="true" />
            </template>

            <template #annotator-action-undo>
              <span
                class="i-carbon:undo w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template #annotator-action-redo>
              <span
                class="i-carbon:redo w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template #annotator-action-delete>
              <span
                class="i-carbon:trash-can w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
            </template>

            <template #optionAnnotator="{ isAnnotator }">
              <span
                v-if="isAnnotator"
                class="i-carbon:edit-off w-6 h-6 text-fg-subtle"
                style="pointer-events: none"
                aria-hidden="true"
              />
              <span
                v-else
                class="i-carbon:edit w-6 h-6 text-fg-subtle"
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
          <span class="i-carbon:data-vis-4 w-8 h-8" />
          <p>{{ $t('package.trends.no_data') }}</p>
        </div>
      </div>

      <!-- Error state -->
      <div v-if="error" class="flex items-center justify-center h-full" role="alert">
        <div class="text-sm text-fg-subtle font-mono text-center flex flex-col items-center gap-2">
          <span class="i-carbon:warning-hex w-8 h-8 text-red-400" />
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

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chart-container {
  animation: fadeInUp 350ms cubic-bezier(0.4, 0, 0.2, 1);
}
</style>

<style>
/* Override default placement of the refresh button to have it to the minimap's side */
@media screen and (min-width: 767px) {
  #version-distribution .vue-data-ui-refresh-button {
    top: -0.6rem !important;
    left: calc(100% + 2rem) !important;
  }
}
</style>
