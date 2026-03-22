<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueUiHorizontalBar } from 'vue-data-ui/vue-ui-horizontal-bar'
import type { VueUiHorizontalBarConfig, VueUiHorizontalBarDatasetItem } from 'vue-data-ui'
import { getFrameworkColor, isListedFramework } from '~/utils/frameworks'
import { createChartPatternSlotMarkup } from '~/utils/charts'
import { drawSmallNpmxLogoAndTaglineWatermark } from '~/composables/useChartWatermark'

import {
  loadFile,
  insertLineBreaks,
  sanitise,
  applyEllipsis,
  copyAltTextForCompareFacetBarChart,
} from '~/utils/charts'

import('vue-data-ui/style.css')

const props = defineProps<{
  values: (FacetValue | null | undefined)[]
  packages: string[]
  label: string
  description: string
  facetLoading?: boolean
}>()

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const { width } = useElementSize(rootEl)
const { copy, copied } = useClipboard()

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

const chartKey = ref(0)

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
  ],
  {
    element: rootEl,
    watchHtmlAttributes: true,
    watchResize: false,
  },
)

const watermarkColors = computed(() => ({
  fg: colors.value.fg ?? OKLCH_NEUTRAL_FALLBACK,
  bg: colors.value.bg ?? OKLCH_NEUTRAL_FALLBACK,
  fgSubtle: colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK,
}))

onMounted(async () => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
})

watch(
  () => colorMode.value,
  value => {
    resolvedMode.value = value === 'dark' ? 'dark' : 'light'
  },
  { flush: 'sync' },
)

watch(
  () => props.packages,
  (newP, oldP) => {
    if (newP.length !== oldP.length) return
    chartKey.value += 1
  },
)

const isDarkMode = computed(() => resolvedMode.value === 'dark')

const dataset = computed<VueUiHorizontalBarDatasetItem[]>(() => {
  if (props.facetLoading) return []
  return props.packages.map((name, index) => {
    const rawValue = props.values[index]?.raw
    return {
      name: insertLineBreaks(applyEllipsis(name)),
      value: typeof rawValue === 'number' ? rawValue : 0,
      color: isListedFramework(name) ? getFrameworkColor(name) : undefined,
      formattedValue: props.values[index]?.display,
    }
  })
})

const skeletonDataset = computed(() =>
  props.packages.map((_pkg, i) => ({
    name: '_',
    value: i + 1,
    color: colors.value.border,
  })),
)

function buildExportFilename(extension: string): string {
  const sanitizedPackages = props.packages.map(p => sanitise(p).slice(0, 10)).join('_')
  const comparisonLabel = sanitise($t('compare.packages.section_comparison'))
  const facetLabel = sanitise(props.label)
  return `${facetLabel}_${comparisonLabel}_${sanitizedPackages}.${extension}`
}

const config = computed<VueUiHorizontalBarConfig>(() => {
  return {
    theme: isDarkMode.value ? 'dark' : '',
    a11y: {
      translations: {
        keyboardNavigation: $t('package.trends.chart_sr.keyboard_navigation_vertical'),
        tableAvailable: $t('package.trends.chart_sr.table_available'),
        tableCaption: $t('package.trends.chart_sr.table_caption'),
      },
    },
    userOptions: {
      buttons: {
        tooltip: false,
        pdf: false,
        fullscreen: false,
        sort: false,
        annotator: false,
        table: false,
        csv: false,
        altCopy: true,
      },
      buttonTitle: {
        img: $t('package.trends.download_file', { fileType: 'PNG' }),
        svg: $t('package.trends.download_file', { fileType: 'SVG' }),
        altCopy: $t('package.trends.copy_alt.button_label'),
      },
      callbacks: {
        img: args => {
          const imageUri = args?.imageUri
          if (!imageUri) return
          loadFile(imageUri, buildExportFilename('png'))
        },
        svg: args => {
          const blob = args?.blob
          if (!blob) return
          const url = URL.createObjectURL(blob)
          loadFile(url, buildExportFilename('svg'))
          URL.revokeObjectURL(url)
        },
        altCopy: ({ dataset: dst, config: cfg }) => {
          copyAltTextForCompareFacetBarChart({
            dataset: dst,
            config: {
              ...cfg,
              facet: props.label,
              description: props.description,
              copy,
              $t,
            },
          })
        },
      },
    },
    skeletonDataset: skeletonDataset.value,
    skeletonConfig: {
      style: {
        chart: {
          backgroundColor: colors.value.bg,
        },
      },
    },
    style: {
      chart: {
        backgroundColor: colors.value.bg,
        height: 60 * props.packages.length,
        layout: {
          bars: {
            rowColor: isDarkMode.value ? colors.value.borderSubtle : colors.value.bgSubtle,
            rowRadius: 4,
            borderRadius: 4,
            dataLabels: {
              fontSize: isMobile.value ? 12 : 18,
              percentage: { show: false },
              offsetX: 12,
              bold: false,
              color: colors.value.fg,
              value: {
                formatter: ({ config: formatterConfig }) => {
                  return formatterConfig?.datapoint?.formattedValue ?? '0'
                },
              },
            },
            nameLabels: {
              fontSize: isMobile.value ? 12 : 18,
              color: colors.value.fgSubtle,
            },
            underlayerColor: colors.value.bg,
          },
          highlighter: {
            opacity: isMobile.value ? 0 : 5,
          },
        },
        legend: {
          show: false,
        },
        title: {
          fontSize: 16,
          bold: false,
          text: props.label,
          color: colors.value.fg,
          subtitle: {
            text: props.description,
            fontSize: 12,
            color: colors.value.fgSubtle,
          },
        },
        tooltip: {
          show: !isMobile.value,
          borderColor: 'transparent',
          backdropFilter: false,
          backgroundColor: 'transparent',
          customFormat: ({ datapoint }) => {
            const name = datapoint?.name?.replace(/\n/g, '<br>') ?? ''
            const safeSeriesIndex = (datapoint?.absoluteIndex as number) ?? 0
            const patternId = `tooltip-pattern-${safeSeriesIndex}`
            const usePattern = safeSeriesIndex !== 0

            const patternMarkup = usePattern
              ? createChartPatternSlotMarkup({
                  id: patternId,
                  seed: safeSeriesIndex,
                  foregroundColor: colors.value.bg!,
                  fallbackColor: 'transparent',
                  maxSize: 24,
                  minSize: 16,
                })
              : ''

            const markerMarkup = usePattern
              ? `
              <rect x="0" y="0" width="20" height="20" rx="3" fill="${datapoint?.color ?? 'transparent'}" />
              <rect x="0" y="0" width="20" height="20" rx="3" fill="url(#${patternId})" />
            `
              : `
              <rect x="0" y="0" width="20" height="20" rx="3" fill="${datapoint?.color ?? 'transparent'}" />
            `

            return `
            <div class="font-mono p-3 border border-border rounded-md bg-[var(--bg)]/10 backdrop-blur-md">
              <div class="grid grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-x-3">
                <div class="w-3 h-3">
                  <svg viewBox="0 0 20 20" class="w-full h-full" aria-hidden="true">
                    <defs>
                      ${patternMarkup}
                    </defs>
                    ${markerMarkup}
                  </svg>
                </div>
                <span class="text-3xs uppercase tracking-wide text-[var(--fg)]/70 truncate">
                  ${name}
                </span>
                <span class="text-base text-[var(--fg)] font-mono tabular-nums text-end">
                  ${datapoint?.formattedValue ?? 0}
                </span>
              </div>
            </div>
          `
          },
        },
      },
    },
  }
})
</script>

<template>
  <div class="font-mono facet-bar">
    <ClientOnly v-if="dataset.length">
      <VueUiHorizontalBar :key="chartKey" :dataset :config class="[direction:ltr]">
        <template #hint="{ isVisible }">
          <p v-if="isVisible" class="text-accent text-xs pt-2" aria-hidden="true">
            {{ $t('compare.packages.bar_chart_nav_hint') }}
          </p>
        </template>

        <template #pattern="{ patternId, seriesIndex }">
          <ChartPatternSlot
            v-if="seriesIndex != 0"
            :id="patternId"
            :seed="seriesIndex"
            :foreground-color="colors.bg!"
            fallback-color="transparent"
            :max-size="24"
            :min-size="16"
          />
        </template>

        <template #svg="{ svg }">
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
      </VueUiHorizontalBar>

      <template #fallback>
        <div class="flex flex-col gap-2 justify-center items-center mb-2">
          <SkeletonInline class="h-4 w-16" />
          <SkeletonInline class="h-4 w-28" />
        </div>
        <div class="flex flex-col gap-1">
          <SkeletonInline class="h-7 w-full" v-for="pkg in packages" :key="pkg" />
        </div>
      </template>
    </ClientOnly>

    <template v-else>
      <div class="flex flex-col gap-2 justify-center items-center mb-2">
        <SkeletonInline class="h-4 w-16" />
        <SkeletonInline class="h-4 w-28" />
      </div>
      <div class="flex flex-col gap-1">
        <SkeletonInline class="h-7 w-full" v-for="pkg in packages" :key="pkg" />
      </div>
    </template>
  </div>
</template>

<style scoped>
:deep(.vue-data-ui-component svg:focus-visible) {
  outline: 1px solid var(--accent-color) !important;
  border-radius: 0.1rem;
  outline-offset: 3px !important;
}
:deep(.vue-ui-user-options-button:focus-visible),
:deep(.vue-ui-user-options :first-child:focus-visible) {
  outline: 0.1rem solid var(--accent-color) !important;
  border-radius: 0.25rem;
}
</style>

<style>
.facet-bar .atom-subtitle {
  width: 80% !important;
  margin: 0 auto;
  height: 2rem;
}
</style>
