<script setup lang="ts">
import { VueUiQuadrant } from 'vue-data-ui/vue-ui-quadrant'
import { NO_DEPENDENCY_ID } from '~/composables/usePackageComparison'
import { getFrameworkColor, isListedFramework } from '~/utils/frameworks'
import {
  createQuadrantDataset,
  type PackageQuadrantInput,
  type PackageQuadrantPoint,
} from '~/utils/compare-quadrant-chart'
import type { VueUiQuadrantConfig, VueUiQuadrantDatasetItem } from 'vue-data-ui'
import {
  sanitise,
  loadFile,
  applyEllipsis,
  copyAltTextForCompareQuadrantChart,
} from '~/utils/charts'
import { drawNpmxLogoAndTaglineWatermark } from '~/composables/useChartWatermark'

import('vue-data-ui/style.css')

const props = defineProps<{
  packagesData: ReadonlyArray<PackageComparisonData | null>
  packages: string[]
}>()

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const { width } = useElementSize(rootEl)
const { copy, copied } = useClipboard()
const compactNumberFormatter = useCompactNumberFormatter()
const bytesFormatter = useBytesFormatter()

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

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

const source = computed<PackageQuadrantInput[]>(() => {
  if (!props.packagesData?.length) return []

  return props.packagesData
    .map((packageItem, index): PackageQuadrantInput | null => {
      if (!packageItem?.package?.name) return null

      const packageNameFromQuery = props.packages[index]
      if (!packageNameFromQuery || packageNameFromQuery === NO_DEPENDENCY_ID) {
        return null
      }

      const typesKind = packageItem.analysis?.types?.kind
      const hasTypes = typesKind === 'included' || typesKind === '@types'

      return {
        license: packageItem.metadata?.license ?? '',
        id: packageItem.package.name,
        name: packageItem.package.name,
        downloads: Number(packageItem.downloads ?? 0),
        totalLikes: Number(packageItem.totalLikes ?? 0),
        packageSize: Number(packageItem.packageSize ?? 0),
        installSize: Number(packageItem.installSize?.totalSize ?? 0),
        dependencies: Number(packageItem.directDeps ?? 0),
        totalDependencies: Number(packageItem.installSize?.dependencyCount ?? 0),
        vulnerabilities: Number(packageItem.vulnerabilities?.count ?? 0),
        deprecated: Boolean(packageItem.metadata?.deprecated),
        types: hasTypes,
        lastUpdated: packageItem.metadata?.lastUpdated ?? null,
      }
    })
    .filter((packageItem): packageItem is PackageQuadrantInput => packageItem !== null)
})

const rawQuadrant = computed(() => createQuadrantDataset(source.value))
const dataset = computed<VueUiQuadrantDatasetItem[]>(() => {
  return rawQuadrant.value.map((el: PackageQuadrantPoint) => {
    return {
      adoptionScore: el.adoptionScore,
      efficiencyScore: el.efficiencyScore,
      id: el.id,
      license: el.license,
      metrics: el.metrics,
      quadrant: el.quadrant,
      fullname: el.name,
      name: applyEllipsis(el.name, 20),
      shape: 'circle',
      color: isListedFramework(el.name) ? getFrameworkColor(el.name) : undefined,
      series: [
        {
          name: applyEllipsis(el.name, 20),
          x: el.x,
          y: el.y,
        },
      ],
    }
  })
})

function buildExportFilename(extension: string): string {
  const translatedPrefix = sanitise($t('compare.quadrant_chart.filename'))
  return `${translatedPrefix}.${extension}`
}

const config = computed<VueUiQuadrantConfig>(() => {
  return {
    theme: isDarkMode.value ? 'dark' : '',
    zoomEnabled: false,
    userOptions: {
      buttons: {
        tooltip: false,
        pdf: false,
        fullscreen: false,
        table: false,
        csv: false,
        altCopy: true,
        labels: false,
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
          copyAltTextForCompareQuadrantChart({
            dataset: dst,
            config: {
              ...cfg,
              copy,
              $t,
            },
          })
        },
      },
    },
    style: {
      chart: {
        backgroundColor: colors.value.bg,
        layout: {
          areas: { show: false },
          grid: {
            stroke: colors.value.borderHover,
            graduations: {
              show: true,
              stroke: colors.value.border,
              color: colors.value.border,
              steps: 5,
              roundingForce: 6,
              fill: isDarkMode.value,
            },
            xAxis: {
              name: $t('compare.quadrant_chart.label_x_axis'),
              show: false,
            },
            yAxis: {
              name: $t('compare.quadrant_chart.label_y_axis'),
              show: false,
            },
          },
          labels: {
            axisLabels: {
              fontSize: 14,
              color: {
                positive: colors.value.fgSubtle,
                negative: colors.value.fgSubtle,
              },
            },
            plotLabels: {
              fontSize: 14,
              offsetY: 16,
              color: colors.value.fg,
            },
            quadrantLabels: {
              tr: {
                text: $t('compare.quadrant_chart.label_top_right').toLocaleUpperCase(),
                fontSize: 12,
                color: colors.value.fgSubtle,
                bold: false,
              },
              br: {
                text: $t('compare.quadrant_chart.label_bottom_right').toLocaleUpperCase(),
                fontSize: 12,
                color: colors.value.fgSubtle,
                bold: false,
              },
              bl: {
                text: $t('compare.quadrant_chart.label_bottom_left').toLocaleUpperCase(),
                fontSize: 12,
                color: colors.value.fgSubtle,
                bold: false,
              },
              tl: {
                text: $t('compare.quadrant_chart.label_top_left').toLocaleUpperCase(),
                fontSize: 12,
                color: colors.value.fgSubtle,
                bold: false,
              },
            },
          },
        },
        legend: { show: false },
        tooltip: {
          show: !isMobile.value,
          borderColor: 'transparent',
          backdropFilter: false,
          backgroundColor: 'transparent',
          showShape: false,
          customFormat: ({ datapoint }) => {
            const isDeprecated = !!datapoint?.category?.metrics?.deprecated
            return `
            <div class="font-mono p-3 border border-border rounded-md bg-bg/10 backdrop-blur-md">
              <div class="grid grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-x-3 border-b border-border pb-2 mb-2">

                <div class="w-3 h-3">
                  <svg viewBox="0 0 20 20" class="w-full h-full" aria-hidden="true">
                    <circle cx="10" cy="10" r="10" fill="${datapoint?.color ?? 'transparent'}" />
                  </svg>
                </div>
                <span class="text-3xs uppercase tracking-wide text-fg/70 truncate">
                  ${sanitise(datapoint?.name ?? '')}
                </span>

                <div class="text-fg-subtle text-xs border border-border rounded-sm px-1">
                  ${sanitise(datapoint?.category?.license)}
                </div>
              </div>

              ${isDeprecated ? `<div class="text-xs text-red-700 dark:text-red-400 my-1">${$t('package.deprecation.package')}</div>` : ``}

              <div class="text-fg text-xs">${$t('compare.quadrant_chart.label_x_axis')}</div>
              <div class="flex flex-col text-xs">
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.downloads.label')}</span>
                  <span class="text-fg text-sm">${compactNumberFormatter.value.format(datapoint?.category?.metrics.downloads ?? 0)}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.totalLikes.label')}</span>
                  <span class="text-fg text-sm">${compactNumberFormatter.value.format(datapoint?.category?.metrics.totalLikes ?? 0)}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.quadrant_chart.label_freshness_score')}</span>
                  <span class="text-fg text-sm">${Math.round(datapoint?.category?.metrics.freshnessPercent ?? 0)}%</span>
                </div>

                <div class="text-fg text-xs mt-4">${$t('compare.quadrant_chart.label_y_axis')}</div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.installSize.label')}</span>
                  <span class="text-fg text-sm">${bytesFormatter.format(datapoint?.category?.metrics.installSize ?? 0)}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.packageSize.label')}</span>
                  <span class="text-fg text-sm">${bytesFormatter.format(datapoint?.category?.metrics.packageSize ?? 0)}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.dependencies.label')}</span>
                  <span class="text-fg text-sm">${datapoint?.category?.metrics.dependencies ?? 0}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.totalDependencies.label')}</span>
                  <span class="text-fg text-sm">${datapoint?.category?.metrics.totalDependencies ?? 0}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.vulnerabilities.label')}</span>
                  <span class="text-fg text-sm">${datapoint?.category?.metrics.vulnerabilities ?? 0}</span>
                </div>
                <div class="flex flex-row items-baseline gap-2">
                  <span class="text-fg-subtle">${$t('compare.facets.items.types.label')}</span>
                  <span class="text-fg text-sm">${datapoint?.category?.metrics.types ? $t('common.yes') : $t('common.no')}</span>
                </div>
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
  <div class="font-mono">
    <div class="flex items-center justify-center gap-2">
      <h3>
        {{ $t('compare.quadrant_chart.title') }}
      </h3>
      <TooltipApp interactive>
        <button
          type="button"
          class="i-lucide:info w-3.5 h-3.5 text-fg-muted cursor-help"
          :aria-label="$t('compare.quadrant_chart.explanation.tooltip_help')"
        />
        <template #content>
          <div class="flex flex-col gap-3">
            <p class="text-xs text-fg-muted">
              {{ $t('compare.quadrant_chart.explanation.introduction') }}
            </p>
            <ul class="text-xs text-fg-subtle list-disc list-inside">
              <li>{{ $t('compare.quadrant_chart.explanation.adoption') }}</li>
              <li>{{ $t('compare.quadrant_chart.explanation.efficiency') }}</li>
            </ul>
            <p class="text-xs text-fg-muted">
              {{ $t('compare.quadrant_chart.explanation.impact_details') }}
            </p>
          </div>
        </template>
      </TooltipApp>
    </div>
    <ClientOnly>
      <VueUiQuadrant :dataset :config>
        <template #svg="{ svg }">
          <g
            v-if="svg.isPrintingSvg || svg.isPrintingImg"
            v-html="
              drawNpmxLogoAndTaglineWatermark({
                svg: {
                  width: svg.width,
                  height: svg.height,
                  drawingArea: {
                    top: svg.top,
                    height: svg.height,
                  },
                },
                colors: watermarkColors,
                translateFn: $t,
                positioning: 'bottom',
                sizeRatioTagline: 0.6,
                sizeRatioLogo: 0.4,
                offsetYTagline: 20,
                offsetYLogo: 12,
              })
            "
          />
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
      </VueUiQuadrant>
    </ClientOnly>
  </div>
</template>

<style scoped>
:deep(.vue-data-ui-component svg:focus-visible) {
  outline: 1px solid var(--accent-color) !important;
  border-radius: 0.1rem;
  outline-offset: 0;
}
:deep(.vue-ui-user-options-button:focus-visible),
:deep(.vue-ui-user-options :first-child:focus-visible) {
  outline: 0.1rem solid var(--accent-color) !important;
  border-radius: 0.25rem;
}

/**
* Temporary override (to be removed if/when a fix in vue-data-ui is found, like a dynamic repositioning of labels, or line-break forcing)
* a long label for a datapoint placed on the border of the svg might be cropped by the overflow-hidden
* set by the library on the chart component.
*/
:deep(.vue-ui-quadrant svg) {
  overflow: visible !important;
}
</style>
