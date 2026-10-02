<script setup lang="ts">
import { useColors } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK } from '~/utils/colors'
import { drawSmallNpmxLogoAndTaglineWatermark } from '~/composables/useChartWatermark'
import TooltipApp from '~/components/Tooltip/App.vue'
import { copyAltTextForVersionsBarChart, sanitise, applyEllipsis } from '~/utils/charts'
import { downloadFileLink } from '~/utils/download'
import { useCopyChartPng } from '~/composables/useCopyChartPng'
import VueUiHorizontalBar, {
  type VueUiHorizontalBarConfig,
  type VueUiHorizontalBarDatasetItem,
} from 'vue-data-ui/vue-ui-horizontal-bar'

import('vue-data-ui/style.css')

const props = defineProps<{
  packageName: string
  hideControls?: boolean
}>()

const { settings } = useSettings()
const { accentColors, selectedAccentColor } = useAccentColor()
const { copy, copied } = useClipboard()
const chartRef = useTemplateRef('chartRef')
const { copiedPng, isCopyingPng, copyChartPng } = useCopyChartPng(chartRef)

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)

onMounted(async () => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'
})

const { colors } = useColors(rootEl)

watch(
  () => colorMode.value,
  value => {
    resolvedMode.value = value === 'dark' ? 'dark' : 'light'
  },
  { flush: 'sync' },
)

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

const ellipsedPackageName = computed(() => applyEllipsis(props.packageName, 32))

function buildExportFilename(extension: string): string {
  const range = dateRangeLabel.value.replaceAll(' ', '_').replaceAll(',', '')

  const label = ellipsedPackageName.value
  return `${sanitise(label ?? '')}_${range}.${extension}`
}

const barDataset = computed<VueUiHorizontalBarDatasetItem[]>(() => {
  return chartDataset.value
    .map(datapoint => {
      return {
        name: datapoint.name,
        value: datapoint.downloads,
        color: accent.value,
      }
    })
    .toReversed()
})

const barChartHeight = computed(() => {
  const imposedPadding = 24 // compensate the library component internal padding
  const unitHeight = 26
  const baseHeight = barDataset.value.length * unitHeight + imposedPadding
  return Math.max(36, baseHeight)
})

const isOrderedByDownloads = computed(
  () => settings.value.versionDistributionChart.isOrderedByDownloads,
)

const barConfig = computed<VueUiHorizontalBarConfig>(() => ({
  userOptions: {
    buttons: {
      pdf: false,
      labels: false,
      fullscreen: false,
      table: false,
      tooltip: false,
      altCopy: true,
      sort: false,
    },
    buttonTitles: {
      csv: $t('package.trends.download_file', { fileType: 'CSV' }),
      img: $t('package.trends.download_file', { fileType: 'PNG' }),
      svg: $t('package.trends.download_file', { fileType: 'SVG' }),
      annotator: $t('package.trends.toggle_annotator'),
      altCopy: $t('package.trends.copy_alt.button_label'), // Do not make this text dependent on the `copied` variable, since this would re-render the component, which is undesirable if the minimap was used to select a time frame.
      open: $t('package.trends.open_options'),
      close: $t('package.trends.close_options'),
    },
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
      altCopy: ({ dataset: dst, config: cfg }) => {
        return copyAltTextForVersionsBarChart({
          dataset: dst,
          config: {
            ...cfg,
            packageName: props.packageName,
            dateRangeLabel: dateRangeLabel.value,
            semverGroupingMode: groupingMode.value,
            copy,
            $t,
            numberFormatter: compactNumberFormatter.value.format,
          },
        })
      },
    },
    useCursorPointer: true,
  },
  style: {
    chart: {
      backgroundColor: colors.value.bg,
      color: colors.value.fg,
      height: barChartHeight.value,
      width: 800,
      layout: {
        bars: {
          sort: isOrderedByDownloads.value ? 'desc' : 'none',
          gap: 6,
          borderRadius: 2,
          underlayerColor: colors.value.bg,
          dataLabels: {
            bold: false,
            color: colors.value.fgSubtle,
            fontSize: 14,
            offsetX: 4,
            value: {
              formatter: ({ value }: { value: number }) => {
                return compactNumberFormatter.value.format(Number.isFinite(value) ? value : 0)
              },
            },
          },
          nameLabels: {
            color: colors.value.fgSubtle,
            fontSize: 14,
            offsetX: -2,
          },
        },
        highlighter: {
          color: colors.value.fg,
        },
      },
      legend: {
        position: 'top',
      },
      title: {
        text: dateRangeLabel.value,
        fontSize: 16,
        bold: false,
        color: colors.value.fgSubtle,
        subtitle: {
          text: $t('package.versions.y_axis_label'),
        },
      },
      tooltip: {
        backgroundColor: colors.value.bg,
        backgroundOpacity: 10,
        color: colors.value.fg,
        borderColor: colors.value.border,
        borderRadius: 6,
      },
    },
  },
}))
</script>

<template>
  <div
    class="w-full flex flex-col"
    id="version-distribution"
    :aria-busy="pending ? 'true' : 'false'"
  >
    <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 sm:items-end mb-6" v-if="!hideControls">
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
            :offset="8"
          >
            <span
              tabindex="0"
              class="i-lucide:info w-3.5 h-3.5 text-fg-subtle cursor-help shrink-0 rounded-sm"
              role="img"
              :aria-label="$t('package.versions.grouping_versions_about')"
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
            :offset="8"
          >
            <span
              tabindex="0"
              class="i-lucide:info w-3.5 h-3.5 text-fg-subtle cursor-help shrink-0 rounded-sm"
              role="img"
              :aria-label="$t('package.versions.grouping_usage_about')"
            />
          </TooltipApp>
        </label>
        <ButtonGroup>
          <ButtonBase
            @click="showLowUsageVersions = false"
            :variant="showLowUsageVersions ? 'secondary' : 'primary'"
          >
            {{ $t('package.versions.grouping_usage_most_used') }}
          </ButtonBase>
          <ButtonBase
            @click="showLowUsageVersions = true"
            :variant="showLowUsageVersions ? 'primary' : 'secondary'"
          >
            {{ $t('package.versions.grouping_usage_all') }}
          </ButtonBase>
        </ButtonGroup>
      </div>
    </div>

    <div class="flex flex-row">
      <SettingsToggle
        v-model="settings.versionDistributionChart.isOrderedByDownloads"
        :label="$t('package.versions.order_by_downloads')"
      />
    </div>

    <h2 id="version-distribution-title" class="sr-only">
      {{ $t('package.versions.distribution_title') }}
    </h2>

    <div role="region" aria-labelledby="version-distribution-title" class="relative">
      <!-- CHART -->
      <ClientOnly v-if="barDataset.length > 0 && !error">
        <div class="chart-container w-full" :key="groupingMode">
          <VueUiHorizontalBar
            :dataset="barDataset"
            :config="barConfig"
            ref="chartRef"
            class="[direction:ltr]"
          >
            <!-- Keyboard navigation hint -->
            <template #hint="{ isVisible }">
              <p v-if="isVisible" class="text-accent text-xs -mt-6 text-center" aria-hidden="true">
                {{ $t('compare.packages.line_chart_nav_hint') }}
              </p>
            </template>

            <!-- Custom tooltip -->
            <template #tooltip="{ datapoint }">
              <div class="font-mono text-xs flex flex-col">
                <div class="flex flex-row gap-2 items-center justify-center">
                  <span class="text-fg-subtle text-xs">
                    {{ datapoint.name }}
                  </span>
                  <span class="text-fg text-lg">
                    {{ compactNumberFormatter.format(datapoint.value) }}
                  </span>
                </div>
              </div>
            </template>

            <!-- Custom legend -->
            <template #legend>
              <div class="flex gap-1 shrink-0 items-center justify-center whitespace-nowrap pb-3">
                <div class="h-3 w-3 shrink-0">
                  <svg viewBox="0 0 2 2" class="w-full">
                    <rect x="0" y="0" width="2" height="2" rx="0.3" :fill="accent" />
                  </svg>
                </div>
                <span class="shrink-0 whitespace-nowrap text-fg-subtle text-sm">
                  {{ ellipsedPackageName }}
                </span>
              </div>
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
            <template #custom-menu-before>
              <ChartCopyPngButton
                :copied="copiedPng"
                :copying="isCopyingPng"
                @click="copyChartPng"
              />
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

            <!-- Watermark -->
            <template #svg="{ svg }">
              <g
                v-if="svg.isPrintingSvg || svg.isPrintingImg || isCopyingPng"
                v-html="
                  drawSmallNpmxLogoAndTaglineWatermark({
                    svg,
                    colors: watermarkColors,
                    translateFn: $t,
                  })
                "
              />
            </template>
          </VueUiHorizontalBar>
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
:deep(.vue-data-ui-component svg:focus-visible) {
  outline: 1px solid var(--accent) !important;
  border-radius: 0.1rem;
  outline-offset: 0 !important;
}

:deep(.vue-ui-user-options-button:focus-visible),
:deep(.vue-ui-user-options :first-child:focus-visible) {
  outline: 0.1rem solid var(--accent) !important;
  border-radius: 0.25rem;
}
</style>

<style>
/* Adds padding to graph title in absence of a configurable css property */
#version-distribution .atom-title {
  padding-top: 20px;
}
</style>
