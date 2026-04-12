<script setup lang="ts">
import { VueUiSparkline } from 'vue-data-ui/vue-ui-sparkline'
import { VueUiPatternSeed } from 'vue-data-ui/vue-ui-pattern-seed'
import { useCssVariables } from '~/composables/useColors'
import {
  type VueUiSparklineConfig,
  type VueUiSparklineDatasetItem,
  type VueUiXyDatasetItem,
} from 'vue-data-ui'
import { getPalette, lightenColor } from 'vue-data-ui/utils'
import { CHART_PATTERN_CONFIG } from '~/utils/charts'

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
}>()

const { locale } = useI18n()
const colorMode = useColorMode()
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

const { colors } = useCssVariables(
  [
    '--bg',
    '--fg',
    '--bg-subtle',
    '--bg-elevated',
    '--border-hover',
    '--fg-subtle',
    '--border',
    '--border-subtle',
  ],
  {
    element: rootEl,
    watchHtmlAttributes: true,
    watchResize: false, // set to true only if a var changes color on resize
  },
)

const isDarkMode = computed(() => resolvedMode.value === 'dark')

const datasets = computed<VueUiSparklineDatasetItem[][]>(() => {
  return (props.dataset ?? []).map(unit => {
    return props.dates.map((period, i) => {
      return {
        period,
        value: unit.series[i] ?? 0,
      }
    })
  })
})

const selectedIndex = ref<number | undefined | null>(null)

function hoverIndex({ index }: { index: number | undefined | null }) {
  if (typeof index === 'number') {
    selectedIndex.value = index
  }
}

function resetHover() {
  selectedIndex.value = null
  step.value += 1 // required to reset all chart instances
}

const configs = computed(() => {
  return (props.dataset || []).map<VueUiSparklineConfig>((unit, i) => {
    const lastIndex = unit.series.length - 1
    const dashIndices = props.showLastDatapointEstimation
      ? Array.from(new Set([...(unit.dashIndices ?? []), lastIndex]))
      : unit.dashIndices

    // Ensure we loop through available palette colours when the series count is higher than the avalable palette
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
  <div class="grid gap-8 sm:grid-cols-2">
    <ClientOnly v-for="(config, i) in configs" :key="`config_${i}`">
      <div @mouseleave="resetHover" @keydown.esc="resetHover" class="w-full max-w-[400px] mx-auto">
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
          :key="`${i}_${step}`"
          :config
          :dataset="datasets?.[i]"
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
</template>
