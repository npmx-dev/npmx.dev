<script setup lang="ts">
import { SelectField } from '#components'
import { ref, computed } from 'vue'
import type { FormatterParams, VueUiScatterConfig, VueUiScatterDatasetItem } from 'vue-data-ui'
import { VueUiScatter } from 'vue-data-ui/vue-ui-scatter'
import { buildCompareScatterChartDataset } from '~/utils/compare-scatter-chart'
import { loadFile, copyAltTextForCompareScatterChart } from '~/utils/charts'

import('vue-data-ui/style.css')

const props = defineProps<{
  packagesData: ReadonlyArray<PackageComparisonData | null>
  packages: string[]
}>()

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const { copy, copied } = useClipboard()

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
    '--border-hover',
    '--accent',
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

const isDarkMode = computed(() => resolvedMode.value === 'dark')

const { facetLabels } = useFacetSelection()

const chartableFacets = computed(() =>
  (
    Object.entries(facetLabels.value) as [
      ComparisonFacet,
      { label: string; description: string; chartable_scatter: boolean },
    ][]
  )
    .map(([name, facet]) => ({
      name,
      label: facet.label,
      description: facet.description,
      chartable: facet.chartable_scatter,
    }))
    .filter(facet => facet.chartable),
)

const selectedFacetX = ref<ComparisonFacet>('downloads')
const selectedFacetY = ref<ComparisonFacet>('installSize')

const dataset = computed<VueUiScatterDatasetItem[]>(() =>
  buildCompareScatterChartDataset(
    props.packagesData,
    props.packages,
    selectedFacetX.value,
    selectedFacetY.value,
  ),
)

function resolveFormatter(facet: ComparisonFacet): FacetInfoWithLabels['formatter'] {
  if (facet === 'lastUpdated') {
    return v => `${Math.round(v)}%` // Expressed as 'freshness score'
  }
  return facetLabels.value[facet].formatter!
}

const formatters = computed(() => ({
  x: resolveFormatter(selectedFacetX.value),
  y: resolveFormatter(selectedFacetY.value),
}))

function resolveAxisLabel(facet: ComparisonFacet) {
  if (facet === 'lastUpdated') {
    return $t('compare.scatter_chart.freshness_score')
  }
  return facetLabels.value[facet].label
}

const axisLabels = computed(() => ({
  x: resolveAxisLabel(selectedFacetX.value),
  y: resolveAxisLabel(selectedFacetY.value),
}))

function buildExportFilename(extension: string): string {
  const translatedPrefix = sanitise(
    $t('compare.scatter_chart.filename', {
      x: axisLabels.value.x,
      y: axisLabels.value.y,
    }),
  ).replaceAll(' ', '_')
  return `${translatedPrefix}.${extension}`
}

const config = computed<VueUiScatterConfig>(() => {
  return {
    theme: isDarkMode.value ? 'dark' : '',
    userOptions: {
      buttons: {
        tooltip: false,
        pdf: false,
        fullscreen: false,
        table: false,
        csv: false,
        altCopy: true,
      },
      buttonTitles: {
        csv: $t('package.trends.download_file', { fileType: 'CSV' }),
        img: $t('package.trends.download_file', { fileType: 'PNG' }),
        svg: $t('package.trends.download_file', { fileType: 'SVG' }),
        annotator: $t('package.trends.toggle_annotator'),
        open: $t('package.trends.open_options'),
        close: $t('package.trends.close_options'),
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
          copyAltTextForCompareScatterChart({
            dataset: dst,
            config: {
              ...cfg,
              copy,
              $t,
              x: {
                label: resolveAxisLabel(selectedFacetX.value),
                formatter: formatters.value.x!,
              },
              y: {
                label: resolveAxisLabel(selectedFacetY.value),
                formatter: formatters.value.y!,
              },
            },
          })
        },
      },
    },
    style: {
      backgroundColor: colors.value.bg,
      color: colors.value.fgSubtle,
      layout: {
        axis: {
          stroke: colors.value.fgSubtle,
        },
        height: 500,
        width: 512,
        padding: {
          top: 0,
          bottom: 56,
          right: 36,
          left: 42,
        },
        correlation: { show: false },
        dataLabels: {
          reverseAxisLabels: true,
          xAxis: {
            name: axisLabels.value.x,
            showValue: false,
            fontSize: 14,
            scales: {
              show: true,
              steps: 7,
              useNiceScale: true,
              labels: {
                color: colors.value.fgSubtle,
                offsetY: 10,
                fontSize: 14,
                formatter: (args: FormatterParams) => {
                  return formatters.value.x!(args.value)
                },
              },
              verticalLines: {
                show: true,
                stroke: colors.value.border,
              },
            },
          },
          yAxis: {
            name: axisLabels.value.y,
            showValue: false,
            fontSize: 14,
            scales: {
              show: true,
              steps: 7,
              useNiceScale: true,
              labels: {
                color: colors.value.fgSubtle,
                fontSize: 14,
                formatter: (args: FormatterParams) => {
                  return formatters.value.y!(args.value)
                },
              },
              horizontalLines: {
                show: true,
                stroke: colors.value.border,
              },
            },
          },
        },
        plots: {
          radius: 6,
          hoverRadiusRatio: 1.2,
          opacity: 1,
          opacityNotSelected: 0.2,
          name: {
            show: true,
            color: colors.value.fg,
          },
          selectors: {
            stroke: colors.value.fgSubtle,
            strokeDasharray: 6,
            markers: {
              radius: 3,
              fill: colors.value.fgSubtle,
              stroke: colors.value.bg,
            },
          },
        },
      },
      legend: {
        position: 'top',
        backgroundColor: 'transparent',
      },
      tooltip: {
        show: false,
      },
    },
  }
})

const step = shallowRef(0)

type AxisHighlight = 'x' | 'y' | null
const highlightedAxis = shallowRef<AxisHighlight>(null)

function toggleAxisHighlight(state: AxisHighlight) {
  highlightedAxis.value = state
}
</script>

<template>
  <div class="font-mono pb-6">
    <div class="">
      <h2
        id="trends-comparison-heading"
        class="text-xs text-fg-subtle uppercase tracking-wider mb-4 mt-10"
      >
        {{
          $t('compare.scatter_chart.title', {
            x: resolveAxisLabel(selectedFacetX),
            y: resolveAxisLabel(selectedFacetY),
          })
        }}
      </h2>
    </div>

    <div class="flex flex-col sm:flex-row gap-4 items-start">
      <div
        class="w-full sm:w-fit order-1 sm:order-2 flex flex-row sm:flex-col gap-2 sm:self-end sm:mb-17"
      >
        <SelectField
          class="w-full"
          id="select-facet-scatter-x"
          v-model="selectedFacetX"
          :items="chartableFacets.map(f => ({ label: resolveAxisLabel(f.name), value: f.name }))"
          :label="$t('compare.scatter_chart.x_axis')"
          size="sm"
          block
          @change="step += 1"
          @mouseenter="toggleAxisHighlight('x')"
          @mouseleave="toggleAxisHighlight(null)"
          @focusin="toggleAxisHighlight('x')"
          @focusout="toggleAxisHighlight(null)"
        />
        <SelectField
          class="w-full"
          id="select-facet-scatter-y"
          v-model="selectedFacetY"
          :items="chartableFacets.map(f => ({ label: resolveAxisLabel(f.name), value: f.name }))"
          :label="$t('compare.scatter_chart.y_axis')"
          size="sm"
          block
          @change="step += 1"
          @mouseenter="toggleAxisHighlight('y')"
          @mouseleave="toggleAxisHighlight(null)"
          @focusin="toggleAxisHighlight('y')"
          @focusout="toggleAxisHighlight(null)"
        />
      </div>

      <ClientOnly>
        <div class="w-full sm:max-w-[450px] order-2 sm:order-1">
          <VueUiScatter :dataset :config :key="step">
            <!-- Keyboard navigation hint -->
            <template #hint="{ isVisible }">
              <p
                v-if="isVisible"
                class="text-accent text-xs -mt-5 text-start px-2"
                aria-hidden="true"
              >
                {{ $t('compare.packages.line_chart_nav_hint') }}
              </p>
            </template>

            <!-- Custom legend -->
            <template #legend="{ legend }">
              <div
                class="flex flex-row flex-wrap gap-x-6 justify-center gap-y-2 px-6 sm:px-10 text-xs"
              >
                <button
                  v-for="datapoint in legend"
                  :key="datapoint.name"
                  :aria-pressed="datapoint.isSegregated"
                  :aria-label="datapoint.name"
                  type="button"
                  class="flex gap-1 place-items-center"
                  @click="datapoint.segregate()"
                >
                  <div class="h-3 w-3">
                    <svg viewBox="0 0 2 2" class="w-full">
                      <circle cx="1" cy="1" r="1" :fill="datapoint.color" />
                    </svg>
                  </div>
                  <span
                    class="text-fg"
                    :style="{
                      textDecoration: datapoint.isSegregated ? 'line-through' : undefined,
                    }"
                  >
                    {{ datapoint.name }}
                  </span>
                </button>
              </div>
            </template>

            <!-- Custom svg content -->
            <template #svg="{ svg }">
              <!-- Watermark -->
              <g
                v-if="svg.isPrintingSvg || svg.isPrintingImg"
                v-html="
                  drawSmallNpmxLogoAndTaglineWatermark({
                    svg,
                    colors: watermarkColors,
                    translateFn: $t,
                    taglineFontSize: 6,
                    offsetYLogo: -12,
                    offsetXTagline: -40,
                  })
                "
              />

              <!-- Highlighted axes when hovering facet inputs -->
              <template v-if="highlightedAxis">
                <line
                  v-if="highlightedAxis === 'x'"
                  :x1="svg.drawingArea.left"
                  :x2="svg.drawingArea.right"
                  :y1="svg.drawingArea.bottom"
                  :y2="svg.drawingArea.bottom"
                  :stroke="colors.accent"
                  stroke-dasharray="5"
                  stroke-linecap="round"
                  stroke-width="2"
                />
                <line
                  v-if="highlightedAxis === 'y'"
                  :x1="svg.drawingArea.left"
                  :x2="svg.drawingArea.left"
                  :y1="svg.drawingArea.top"
                  :y2="svg.drawingArea.bottom"
                  :stroke="colors.accent"
                  stroke-dasharray="5"
                  stroke-linecap="round"
                  stroke-width="2"
                />
              </template>
            </template>

            <template #menuIcon="{ isOpen }">
              <span v-if="isOpen" class="i-lucide:x w-6 h-6" aria-hidden="true" />
              <span v-else class="i-lucide:ellipsis-vertical w-6 h-6" aria-hidden="true" />
            </template>
            <template #optionImg>
              <span class="text-fg-subtle font-mono pointer-events-none">PNG</span>
            </template>
            <template #optionSvg>
              <span class="text-fg-subtle font-mono pointer-events-none">SVG</span>
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
          </VueUiScatter>
        </div>

        <template #fallback>
          <SkeletonInline class="w-full sm:max-w-[450px] h-[400px]" />
        </template>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
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
</style>
