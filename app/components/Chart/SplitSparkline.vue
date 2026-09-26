<script setup lang="ts">
import {
  VueUiSparkline,
  type VueUiSparklineConfig,
  type VueUiSparklineDatasetItem,
} from 'vue-data-ui/vue-ui-sparkline'
import { VueUiPatternSeed } from 'vue-data-ui/vue-ui-pattern-seed'
import { useColors } from '~/composables/useColors'
import type { VueUiXyDatasetItem } from 'vue-data-ui/vue-ui-xy'
import { getPalette, lightenColor } from 'vue-data-ui/utils'
import { CHART_PATTERN_CONFIG } from '~/utils/charts'
import { isMissingDownloadValue } from '#shared/utils/trends-chart'
import type { ChartTimeGranularity } from '~/types/chart'

import('vue-data-ui/style.css')

const props = defineProps<{
  dataset?: Array<
    VueUiXyDatasetItem & {
      color?: string
      series: number[]
      dashIndices?: number[]
    }
  >
  dates: number[]
  datetimeFormatterOptions: {
    year: string
    month: string
    day: string
  }
  showLastDatapointEstimation: boolean
  nullifyZeroValues?: boolean
  largePackageSeries?: boolean[]
  granularity: ChartTimeGranularity
}>()

const { locale } = useI18n()
const colorMode = useColorMode()
const numberFormatter = useNumberFormatter()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const palette = getPalette('')

const step = ref(0)

onMounted(() => {
  rootEl.value = document.documentElement
})

watch(
  () => colorMode.value,
  value => {
    resolvedMode.value = value === 'dark' ? 'dark' : 'light'
  },
  { flush: 'sync', immediate: true },
)

const { colors } = useColors(rootEl)

const isDarkMode = computed(() => resolvedMode.value === 'dark')

const selectedIndex = ref<number | undefined | null>(null)
const isInteracting = ref(false)

function isLargeSeries(seriesIndex: number): boolean {
  return props.largePackageSeries?.[seriesIndex] === true
}

function getLastValidValue(
  series: Array<number | null | undefined>,
  beforeIndex: number,
): number | null {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const value = series[index]
    if (isMissingDownloadValue(value)) continue
    const numericValue = Number(value)
    if (Number.isFinite(numericValue)) return numericValue
  }
  return null
}

function formatDataLabel(seriesIndex: number, value: number): string {
  const series = props.dataset?.[seriesIndex]?.series ?? []
  const lastIndex = Math.min(series.length, props.dates.length) - 1

  // Idle state: the sparkline label shows the final datapoint: if the value is null, for a large package, show the last recorded valid value
  if (!isInteracting.value || typeof selectedIndex.value !== 'number') {
    const rawLastValue = series[lastIndex]

    if (isLargeSeries(seriesIndex) && isMissingDownloadValue(rawLastValue)) {
      const lastValidValue = getLastValidValue(series, lastIndex)
      if (lastValidValue !== null) {
        return `${numberFormatter.value.format(lastValidValue)}*`
      }
    }

    return numberFormatter.value.format(value)
  }

  // Hover | kbd interaction: show the actual value at the hovered index
  const rawValue = series[selectedIndex.value]
  if (isLargeSeries(seriesIndex) && isMissingDownloadValue(rawValue)) {
    return $t('package.trends.no_data_short')
  }

  return numberFormatter.value.format(value)
}

const datasets = computed<VueUiSparklineDatasetItem[][]>(() => {
  return (props.dataset ?? []).map((unit, seriesIndex) => {
    const lastIndex = Math.min(unit.series.length, props.dates.length) - 1
    const rawLastValue = unit.series[lastIndex]
    const hasNoDataTail =
      isLargeSeries(seriesIndex) && lastIndex >= 0 && isMissingDownloadValue(rawLastValue)
    const lastValidValue = hasNoDataTail ? getLastValidValue(unit.series, lastIndex) : null

    return props.dates.map((period, index) => {
      const rawValue = unit.series[index]

      // Large package with a 0 or null last value : keep the final x index, but render it at the same y value as the previous valid datapoint
      if (hasNoDataTail && index === lastIndex && lastValidValue !== null) {
        return { period, value: lastValidValue }
      }

      return {
        period,
        value:
          rawValue === 0
            ? props.nullifyZeroValues && hasNoDataTail
              ? index === props.dates.length - 1
                ? 0
                : null
              : 0
            : rawValue || (index === props.dates.length - 1 ? 0 : null),
      }
    })
  })
})

function hoverIndex({ index }: { index: number | undefined | null }) {
  if (typeof index === 'number') {
    selectedIndex.value = index
  }
}

function startInteraction() {
  isInteracting.value = true
}

function resetHover() {
  isInteracting.value = false
  selectedIndex.value = null
  step.value += 1 // required to reset all chart instances
}

const configs = computed(() => {
  return (props.dataset || []).map<VueUiSparklineConfig>((unit, i) => {
    const lastIndex = Math.min(unit.series.length, props.dates.length) - 1
    const hasNoDataTail =
      isLargeSeries(i) && lastIndex >= 0 && isMissingDownloadValue(unit.series[lastIndex])

    const dashIndices = Array.from(
      new Set([
        ...(unit.dashIndices ?? []),
        ...(props.showLastDatapointEstimation && lastIndex >= 0 ? [lastIndex] : []),
        ...(hasNoDataTail ? [lastIndex] : []),
      ]),
    )

    // Ensure we loop through available palette colours when the series count is higher than the available palette
    const fallbackColor = palette[i] ?? palette[i % palette.length] ?? palette[0]!
    const seriesColor = unit.color ?? fallbackColor
    const lightenedSeriesColor: string = unit.color
      ? (lightenOklch(unit.color, 0.5) ?? seriesColor)
      : (lightenColor(seriesColor, 0.5) ?? seriesColor) // palette uses hex colours

    return {
      a11y: {
        translations: {
          keyboardNavigation: $t(
            'package.trends.chart_assistive_text.keyboard_navigation_horizontal',
          ),
          tableAvailable: $t('package.trends.chart_assistive_text.table_available'),
          tableCaption: $t('package.trends.chart_assistive_text.table_caption'),
        },
      },
      theme: isDarkMode.value ? 'dark' : '',
      temperatureColors: {
        show: isDarkMode.value,
        colors: [lightenedSeriesColor, seriesColor],
      },
      skeletonConfig: {
        style: {
          backgroundColor: 'transparent',
          dataLabel: {
            show: true,
            color: 'transparent',
          },
          area: {
            color: colors.value.borderHover,
            useGradient: false,
            opacity: 10,
          },
          line: {
            color: colors.value.borderHover,
          },
        },
      },
      skeletonDataset: Array.from({ length: unit.series.length }, () => 0),
      style: {
        backgroundColor: 'transparent',
        animation: { show: false },
        area: {
          color: colors.value.borderHover,
          useGradient: false,
          opacity: 10,
        },
        dataLabel: {
          offsetX: -12,
          fontSize: 24,
          bold: false,
          color: colors.value.fg,
          formatter: ({ value }) => formatDataLabel(i, value),
          datetimeFormatter: {
            enable: true,
            locale: locale.value,
            useUTC: true,
            options: props.datetimeFormatterOptions,
          },
        },
        line: {
          color: seriesColor,
          dashIndices,
          dashArray: 3,
          cutNullValues: false,
          nullDashes: {
            show: true,
          },
        },
        plot: {
          radius: 6,
          stroke: isDarkMode.value ? 'oklch(0.985 0 0)' : 'oklch(0.145 0 0)',
        },
        title: {
          fontSize: 12,
          color: colors.value.fgSubtle,
          bold: false,
        },
        verticalIndicator: {
          strokeDasharray: 0,
          color: colors.value.fgSubtle,
        },
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      },
    }
  })
})
</script>

<template>
  <div class="grid gap-8 sm:grid-cols-2 mb-4">
    <ClientOnly v-for="(config, i) in configs" :key="`config_${i}`">
      <div
        @mouseenter="startInteraction"
        @focusin="startInteraction"
        @mouseleave="resetHover"
        @focusout="resetHover"
        @keydown.esc="resetHover"
        class="w-full max-w-[400px] mx-auto"
      >
        <div class="flex gap-2 place-items-center">
          <div class="h-5 w-5">
            <svg viewBox="0 0 30 30" class="w-full">
              <defs>
                <VueUiPatternSeed
                  v-if="i != 0"
                  :id="`marker_${i}`"
                  :seed="i"
                  :foreground-color="colors.bg!"
                  :background-color="
                    dataset?.[i]?.color ??
                    palette[i] ??
                    palette[i % palette.length] ??
                    palette[0] ??
                    'transparent'
                  "
                  :max-size="CHART_PATTERN_CONFIG.maxSize"
                  :min-size="CHART_PATTERN_CONFIG.minSize"
                  :disambiguator="CHART_PATTERN_CONFIG.disambiguator"
                />
              </defs>
              <rect
                x="0"
                y="0"
                width="30"
                height="30"
                rx="3"
                :fill="i === 0 ? (dataset?.[0]?.color ?? palette[0]) : `url(#marker_${i})`"
              />
            </svg>
          </div>
          {{ applyEllipsis(dataset?.[i]?.name ?? '', 27) }}
        </div>
        <VueUiSparkline
          v-if="datasets[i]"
          :key="`${i}_${step}`"
          :config
          :dataset="datasets[i]"
          :selectedIndex
          @hoverIndex="hoverIndex"
        >
          <!-- Keyboard navigation hint -->
          <template #hint="{ isVisible }">
            <p v-if="isVisible" class="text-accent text-xs text-center mt-2" aria-hidden="true">
              {{ $t('package.downloads.sparkline_nav_hint') }}
            </p>
          </template>

          <template #skeleton>
            <!-- This empty div overrides the default built-in scanning animation on load -->
            <div></div>
          </template>
        </VueUiSparkline>
      </div>

      <template #fallback>
        <!-- Skeleton matching VueUiSparkline layout (title 24px + SVG aspect 500:80) -->
        <div class="max-w-xs">
          <!-- Title row: fontSize * 2 = 24px -->
          <div class="h-6 flex items-center ps-3">
            <SkeletonInline class="h-3 w-36" />
          </div>
          <!-- Chart area: matches SVG viewBox 500:80 -->
          <div class="aspect-[500/80] flex items-center">
            <!-- Data label (covers ~42% width, matching dataLabel.offsetX) -->
            <div class="w-[42%] flex items-center ps-0.5">
              <SkeletonInline class="h-7 w-24" />
            </div>
            <!-- Sparkline line placeholder -->
            <div class="flex-1 flex items-end pe-3">
              <SkeletonInline class="h-px w-full" />
            </div>
          </div>
        </div>
      </template>
    </ClientOnly>
  </div>
  <p
    v-if="granularity === 'daily'"
    id="last-recorded-value-note"
    class="mb-6 text-xs text-fg-subtle"
  >
    {{ $t('package.trends.last_recorded_value') }}
  </p>
</template>
