<script setup lang="ts">
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import type { VueUiXyDatasetItem } from 'vue-data-ui'
import { useElementSize } from '@vueuse/core'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch } from '~/utils/colors'

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

const { width } = useElementSize(rootEl)
const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

const { groupingMode, hideSmallVersions, pending, error, chartDataset, hasData } =
  useVersionDistribution(() => props.packageName)

const compactNumberFormatter = useCompactNumberFormatter()

const chartConfig = computed(() => {
  return {
    theme: isDarkMode.value ? 'dark' : 'default',
    chart: {
      height: isMobile.value ? 500 : 400,
      backgroundColor: colors.value.bg,
      padding: {
        top: 24,
        right: 24,
        bottom: xAxisLabels.value.length > 10 ? 100 : 72, // More space for rotated labels
        left: isMobile.value ? 60 : 80,
      },
      userOptions: {
        buttons: { pdf: false, labels: false, fullscreen: false, table: false, tooltip: false },
      },
      grid: {
        stroke: colors.value.border,
        labels: {
          fontSize: isMobile.value ? 24 : 16,
          color: pending.value ? colors.value.border : colors.value.fgSubtle,
          axis: {
            yLabel: 'Downloads',
            xLabel: '',
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
            show: true,
            values: xAxisLabels.value,
            fontSize: isMobile.value ? 14 : 12,
            color: colors.value.fgSubtle,
            rotation: xAxisLabels.value.length > 10 ? 45 : 0,
          },
        },
      },
      timeTag: {
        show: false,
      },
      highlighter: { useLine: false },
      legend: { show: false },
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
        customFormat: (params: any) => {
          const { datapoint, absoluteIndex, bars } = params
          if (!datapoint) return ''

          // Use absoluteIndex to get the correct version from chartDataset
          const index = Number(absoluteIndex ?? 0)
          const chartItem = chartDataset.value[index]

          if (!chartItem) return ''

          const barValue = bars?.[0]?.values?.[index]
          const raw = Number(barValue ?? chartItem.downloads ?? 0)
          const v = compactNumberFormatter.value.format(Number.isFinite(raw) ? raw : 0)

          return `<div class="font-mono text-xs p-3 border border-border rounded-md bg-[var(--bg)]/10 backdrop-blur-md">
            <div class="flex flex-col gap-2">
              <div class="flex items-center justify-between gap-4">
                <span class="text-3xs uppercase tracking-wide text-[var(--fg)]/70">
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
    userOptions: {
      show: false,
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
      name: 'Downloads',
      series: chartDataset.value.map(item => item.downloads),
      type: 'bar' as const,
      color: accent.value,
    },
  ]
})

const xAxisLabels = computed(() => {
  return chartDataset.value.map(item => item.name)
})
</script>

<template>
  <div
    class="w-full relative"
    :class="isMobile ? 'min-h-[600px]' : 'min-h-[500px]'"
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
            class="inline-flex items-center bg-bg-subtle border border-border rounded-md overflow-hidden w-fit"
            role="group"
            :aria-label="$t('package.versions.distribution_title')"
          >
            <button
              type="button"
              :class="[
                'px-4 py-1.75 font-mono text-sm transition-colors',
                groupingMode === 'major'
                  ? 'bg-accent text-bg font-medium'
                  : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50',
              ]"
              :aria-pressed="groupingMode === 'major'"
              :disabled="pending"
              @click="groupingMode = 'major'"
            >
              {{ $t('package.versions.grouping_major') }}
            </button>
            <button
              type="button"
              :class="[
                'px-4 py-1.75 font-mono text-sm transition-colors border-is border-border',
                groupingMode === 'minor'
                  ? 'bg-accent text-bg font-medium'
                  : 'text-fg-subtle hover:text-fg hover:bg-bg-subtle/50',
              ]"
              :aria-pressed="groupingMode === 'minor'"
              :disabled="pending"
              @click="groupingMode = 'minor'"
            >
              {{ $t('package.versions.grouping_minor') }}
            </button>
          </div>
        </div>
      </div>

      <SettingsToggle
        v-model="hideSmallVersions"
        :label="$t('package.versions.hide_old_versions')"
        :tooltip="$t('package.versions.hide_old_versions_tooltip')"
        tooltip-position="right"
        :tooltip-teleport-to="inModal ? '#chart-modal' : undefined"
        justify="start"
        :class="{ 'opacity-50 pointer-events-none': pending }"
      />
    </div>

    <h2 id="version-distribution-title" class="sr-only">
      {{ $t('package.versions.distribution_title') }}
    </h2>

    <div
      role="region"
      aria-labelledby="version-distribution-title"
      class="relative flex items-center justify-center"
      :class="isMobile ? 'min-h-[500px]' : 'min-h-[400px]'"
    >
      <div
        v-if="pending"
        role="status"
        aria-live="polite"
        class="text-xs text-fg-subtle font-mono bg-bg/70 backdrop-blur px-3 py-2 rounded-md border border-border"
      >
        {{ $t('common.loading') }}
      </div>

      <div
        v-else-if="error"
        class="text-sm text-fg-subtle font-mono text-center flex flex-col items-center gap-2"
        role="alert"
      >
        <span class="i-carbon:warning-hex w-8 h-8 text-red-400" />
        <p>{{ error.message }}</p>
        <p class="text-xs">Package: {{ packageName }}</p>
      </div>

      <div
        v-else-if="!hasData"
        class="text-sm text-fg-subtle font-mono text-center flex flex-col items-center gap-2"
      >
        <span class="i-carbon:data-vis-4 w-8 h-8" />
        <p>{{ $t('package.trends.no_data') }}</p>
      </div>

      <ClientOnly v-else-if="xyDataset.length > 0">
        <div
          class="chart-container w-full h-[400px] sm:h-[400px]"
          :class="{ 'h-[500px]': isMobile }"
        >
          <VueUiXy :dataset="xyDataset" :config="chartConfig" class="[direction:ltr]" />
        </div>
      </ClientOnly>
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
