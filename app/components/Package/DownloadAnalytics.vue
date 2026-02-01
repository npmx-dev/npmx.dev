<script setup lang="ts">
import type { VueUiXyDatasetItem } from 'vue-data-ui'
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import { useDebounceFn, useElementSize } from '@vueuse/core'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch } from '~/utils/colors'

const props = defineProps<{
  weeklyDownloads: WeeklyDownloadPoint[]
  inModal?: boolean
  packageName: string
  createdIso: string | null
}>()

const { accentColors, selectedAccentColor } = useAccentColor()
const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)

const { width } = useElementSize(rootEl)

const chartKey = ref(0)

let chartRemountTimeoutId: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'

  // If the chart is painted too early, built-in auto-sizing does not adapt to the final container size
  chartRemountTimeoutId = setTimeout(() => {
    chartKey.value += 1
    chartRemountTimeoutId = null
  }, 10)
})

onBeforeUnmount(() => {
  if (chartRemountTimeoutId !== null) {
    clearTimeout(chartRemountTimeoutId)
    chartRemountTimeoutId = null
  }
})

const { colors } = useCssVariables(
  ['--bg', '--bg-subtle', '--bg-elevated', '--fg-subtle', '--border', '--border-subtle'],
  {
    element: rootEl,
    watchHtmlAttributes: true,
    watchResize: false, // set to true only if a var changes color on resize
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
  for (const item of accentColors) {
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

const mobileBreakpointWidth = 640

const isMobile = computed(() => {
  return width.value > 0 && width.value < mobileBreakpointWidth
})

type ChartTimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
type EvolutionData =
  | DailyDownloadPoint[]
  | WeeklyDownloadPoint[]
  | MonthlyDownloadPoint[]
  | YearlyDownloadPoint[]

type DateRangeFields = {
  startDate?: string
  endDate?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWeeklyDataset(data: unknown): data is WeeklyDownloadPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'weekStart' in data[0] &&
    'weekEnd' in data[0] &&
    'downloads' in data[0]
  )
}
function isDailyDataset(data: unknown): data is DailyDownloadPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'day' in data[0] &&
    'downloads' in data[0]
  )
}
function isMonthlyDataset(data: unknown): data is MonthlyDownloadPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'month' in data[0] &&
    'downloads' in data[0]
  )
}
function isYearlyDataset(data: unknown): data is YearlyDownloadPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'year' in data[0] &&
    'downloads' in data[0]
  )
}

function formatXyDataset(
  selectedGranularity: ChartTimeGranularity,
  dataset: EvolutionData,
): { dataset: VueUiXyDatasetItem[] | null; dates: string[] } {
  if (selectedGranularity === 'weekly' && isWeeklyDataset(dataset)) {
    return {
      dataset: [
        {
          name: props.packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: accent.value,
        },
      ],
      dates: dataset.map(d =>
        $t('package.downloads.date_range_multiline', {
          start: d.weekStart,
          end: d.weekEnd,
        }),
      ),
    }
  }
  if (selectedGranularity === 'daily' && isDailyDataset(dataset)) {
    return {
      dataset: [
        {
          name: props.packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: accent.value,
        },
      ],
      dates: dataset.map(d => d.day),
    }
  }
  if (selectedGranularity === 'monthly' && isMonthlyDataset(dataset)) {
    return {
      dataset: [
        {
          name: props.packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: accent.value,
        },
      ],
      dates: dataset.map(d => d.month),
    }
  }
  if (selectedGranularity === 'yearly' && isYearlyDataset(dataset)) {
    return {
      dataset: [
        {
          name: props.packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: accent.value,
        },
      ],
      dates: dataset.map(d => d.year),
    }
  }
  return { dataset: null, dates: [] }
}

function toIsoDateOnly(value: string): string {
  return value.slice(0, 10)
}

function isValidIsoDateOnly(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function safeMin(a: string, b: string): string {
  return a.localeCompare(b) <= 0 ? a : b
}

function safeMax(a: string, b: string): string {
  return a.localeCompare(b) >= 0 ? a : b
}

function extractDates(dateLabel: string): [string, string] | null {
  const matches = dateLabel.match(/\b(\d{4}(?:-\d{2}-\d{2})?)\b/g) // either yyyy or yyyy-mm-dd
  if (!matches) return null

  const first = matches.at(0)
  const last = matches.at(-1)

  if (!first || !last || first === last) return null

  return [first, last]
}

/**
 * Two-phase state:
 * - selectedGranularity: immediate UI
 * - displayedGranularity: only updated once data is ready
 */
const selectedGranularity = shallowRef<ChartTimeGranularity>('weekly')
const displayedGranularity = shallowRef<ChartTimeGranularity>('weekly')

/**
 * Date range inputs.
 * They are initialized from the current effective range:
 * - weekly: from weeklyDownloads first -> weekStart/weekEnd
 * - fallback: last 30 days ending yesterday (client-side)
 */
const startDate = shallowRef<string>('') // YYYY-MM-DD
const endDate = shallowRef<string>('') // YYYY-MM-DD
const hasUserEditedDates = shallowRef(false)

function initDateRangeFromWeekly() {
  if (hasUserEditedDates.value) return
  if (!props.weeklyDownloads?.length) return

  const first = props.weeklyDownloads[0]
  const last = props.weeklyDownloads[props.weeklyDownloads.length - 1]
  const start = first?.weekStart ? toIsoDateOnly(first.weekStart) : ''
  const end = last?.weekEnd ? toIsoDateOnly(last.weekEnd) : ''
  if (isValidIsoDateOnly(start)) startDate.value = start
  if (isValidIsoDateOnly(end)) endDate.value = end
}

function initDateRangeFallbackClient() {
  if (hasUserEditedDates.value) return
  if (!import.meta.client) return
  if (startDate.value && endDate.value) return

  const today = new Date()
  const yesterday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  )
  const end = yesterday.toISOString().slice(0, 10)

  const startObj = new Date(yesterday)
  startObj.setUTCDate(startObj.getUTCDate() - 29)
  const start = startObj.toISOString().slice(0, 10)

  if (!startDate.value) startDate.value = start
  if (!endDate.value) endDate.value = end
}

watch(
  () => props.weeklyDownloads?.length,
  () => {
    initDateRangeFromWeekly()
    initDateRangeFallbackClient()
  },
  { immediate: true },
)

const initialStartDate = shallowRef<string>('') // YYYY-MM-DD
const initialEndDate = shallowRef<string>('') // YYYY-MM-DD

function setInitialRangeIfEmpty() {
  if (initialStartDate.value || initialEndDate.value) return
  if (startDate.value) initialStartDate.value = startDate.value
  if (endDate.value) initialEndDate.value = endDate.value
}

watch(
  [startDate, endDate],
  () => {
    // mark edited only when both have some value (prevents init watchers from flagging too early)
    if (startDate.value || endDate.value) hasUserEditedDates.value = true
    setInitialRangeIfEmpty()
  },
  { immediate: true, flush: 'post' },
)

const showResetButton = computed(() => {
  if (!initialStartDate.value && !initialEndDate.value) return false
  return startDate.value !== initialStartDate.value || endDate.value !== initialEndDate.value
})

const options = shallowRef<
  | { granularity: 'day'; startDate?: string; endDate?: string }
  | { granularity: 'week'; weeks: number; startDate?: string; endDate?: string }
  | { granularity: 'month'; months: number; startDate?: string; endDate?: string }
  | { granularity: 'year'; startDate?: string; endDate?: string }
>({ granularity: 'week', weeks: 52 })

function applyDateRange<T extends Record<string, unknown>>(base: T): T & DateRangeFields {
  const next: T & DateRangeFields = { ...base }

  const start = startDate.value ? toIsoDateOnly(startDate.value) : ''
  const end = endDate.value ? toIsoDateOnly(endDate.value) : ''

  const validStart = start && isValidIsoDateOnly(start) ? start : ''
  const validEnd = end && isValidIsoDateOnly(end) ? end : ''

  if (validStart && validEnd) {
    next.startDate = safeMin(validStart, validEnd)
    next.endDate = safeMax(validStart, validEnd)
  } else {
    if (validStart) next.startDate = validStart
    else delete next.startDate

    if (validEnd) next.endDate = validEnd
    else delete next.endDate
  }

  return next
}

watch(
  [selectedGranularity, startDate, endDate],
  ([granularityValue]) => {
    if (granularityValue === 'daily') options.value = applyDateRange({ granularity: 'day' })
    else if (granularityValue === 'weekly')
      options.value = applyDateRange({ granularity: 'week', weeks: 52 })
    else if (granularityValue === 'monthly')
      options.value = applyDateRange({ granularity: 'month', months: 24 })
    else options.value = applyDateRange({ granularity: 'year' })
  },
  { immediate: true },
)

const { fetchPackageDownloadEvolution } = useCharts()

const evolution = shallowRef<EvolutionData>(props.weeklyDownloads)
const pending = shallowRef(false)

let lastRequestKey = ''
let requestToken = 0

const debouncedLoad = useDebounceFn(() => {
  load()
}, 1000)

async function load() {
  if (!import.meta.client) return
  if (!props.inModal) return

  const o = options.value
  const extraBase =
    o.granularity === 'week'
      ? `w:${String(o.weeks ?? '')}`
      : o.granularity === 'month'
        ? `m:${String(o.months ?? '')}`
        : ''

  const startKey = (o as any).startDate ?? ''
  const endKey = (o as any).endDate ?? ''
  const requestKey = `${props.packageName}|${props.createdIso ?? ''}|${o.granularity}|${extraBase}|${startKey}|${endKey}`

  if (requestKey === lastRequestKey) return
  lastRequestKey = requestKey

  const hasExplicitRange = Boolean((o as any).startDate || (o as any).endDate)
  if (o.granularity === 'week' && props.weeklyDownloads?.length && !hasExplicitRange) {
    evolution.value = props.weeklyDownloads
    pending.value = false
    displayedGranularity.value = 'weekly'
    return
  }

  pending.value = true
  const currentToken = ++requestToken

  try {
    const result = await fetchPackageDownloadEvolution(
      () => props.packageName,
      () => props.createdIso,
      () => o as any, // FIXME: any
    )

    if (currentToken !== requestToken) return

    evolution.value = (result as EvolutionData) ?? []
    displayedGranularity.value = selectedGranularity.value
  } catch {
    if (currentToken !== requestToken) return
    evolution.value = []
  } finally {
    if (currentToken === requestToken) {
      pending.value = false
    }
  }
}

watch(
  () => props.inModal,
  () => {
    // modal open/close should be immediate
    load()
  },
  { immediate: true },
)

watch(
  () => [
    props.packageName,
    props.createdIso,
    options.value.granularity,
    (options.value as any).weeks,
    (options.value as any).months,
  ],
  () => {
    // changing package or granularity should be immediate
    load()
  },
  { immediate: true },
)

watch(
  () => [(options.value as any).startDate, (options.value as any).endDate],
  () => {
    // date typing / picking should be debounced
    debouncedLoad()
  },
  { immediate: true },
)

const effectiveData = computed<EvolutionData>(() => {
  if (displayedGranularity.value === 'weekly' && props.weeklyDownloads?.length) {
    if (isWeeklyDataset(evolution.value) && evolution.value.length) return evolution.value
    return props.weeklyDownloads
  }
  return evolution.value
})

const chartData = computed<{ dataset: VueUiXyDatasetItem[] | null; dates: string[] }>(() => {
  return formatXyDataset(displayedGranularity.value, effectiveData.value)
})

const formatter = ({ value }: { value: number }) => formatCompactNumber(value, { decimals: 1 })

const loadFile = (link: string, filename: string) => {
  const a = document.createElement('a')
  a.href = link
  a.download = filename
  a.click()
  a.remove()
}

const config = computed(() => {
  return {
    theme: isDarkMode.value ? 'dark' : 'default',
    chart: {
      height: isMobile.value ? 950 : 600,
      userOptions: {
        buttons: {
          pdf: false,
          labels: false,
          fullscreen: false,
          table: false,
          tooltip: false,
        },
        buttonTitles: {
          csv: $t('package.downloads.download_file', { fileType: 'CSV' }),
          img: $t('package.downloads.download_file', { fileType: 'PNG' }),
          svg: $t('package.downloads.download_file', { fileType: 'SVG' }),
          annotator: $t('package.downloads.toggle_annotator'),
        },
        callbacks: {
          img: ({ imageUri }: { imageUri: string }) => {
            loadFile(
              imageUri,
              `${props.packageName}-${selectedGranularity.value}_${startDate.value}_${endDate.value}.png`,
            )
          },
          csv: (csvStr: string) => {
            // Extract multiline date format template and replace newlines with spaces in CSV
            // This ensures CSV compatibility by converting multiline date ranges to single-line format
            const PLACEHOLDER_CHAR = '\0'
            const multilineDateTemplate = $t('package.downloads.date_range_multiline', {
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
            loadFile(
              url,
              `${props.packageName}-${selectedGranularity.value}_${startDate.value}_${endDate.value}.csv`,
            )
            URL.revokeObjectURL(url)
          },
          svg: ({ blob }: { blob: Blob }) => {
            const url = URL.createObjectURL(blob)
            loadFile(
              url,
              `${props.packageName}-${selectedGranularity.value}_${startDate.value}_${endDate.value}.svg`,
            )
            URL.revokeObjectURL(url)
          },
        },
      },
      backgroundColor: colors.value.bg,
      grid: {
        stroke: colors.value.border,
        labels: {
          fontSize: isMobile.value ? 24 : 16,
          axis: {
            yLabel: $t('package.downloads.y_axis_label', {
              granularity: $t(`package.downloads.granularity_${selectedGranularity.value}`),
            }),
            xLabel: props.packageName,
            yLabelOffsetX: 12,
            fontSize: isMobile.value ? 32 : 24,
          },
          xAxisLabels: {
            show: !isMobile.value,
            values: chartData.value?.dates,
            showOnlyAtModulo: true,
            modulo: 12,
          },
          yAxis: {
            formatter,
            useNiceScale: true,
          },
        },
      },
      highlighter: {
        useLine: true,
      },
      legend: {
        show: false, // As long as a single package is displayed
      },
      tooltip: {
        teleportTo: '#chart-modal',
        borderColor: 'transparent',
        backdropFilter: false,
        backgroundColor: 'transparent',
        customFormat: ({
          absoluteIndex,
          datapoint,
        }: {
          absoluteIndex: number
          datapoint: Record<string, any>
        }) => {
          if (!datapoint) return ''
          const displayValue = formatter({ value: datapoint[0]?.value ?? 0 })
          return `<div class="flex flex-col font-mono text-xs p-3 border border-border rounded-md bg-[var(--bg)]/10 backdrop-blur-md">
          <span class="text-fg-subtle">${chartData.value?.dates[absoluteIndex]}</span>
          <span class="text-xl">${displayValue}</span>
        </div>
        `
        },
      },
      zoom: {
        maxWidth: isMobile.value ? 350 : 500,
        customFormat:
          displayedGranularity.value !== 'weekly'
            ? undefined
            : ({ absoluteIndex, side }: { absoluteIndex: number; side: 'left' | 'right' }) => {
                const parts = extractDates(chartData.value.dates[absoluteIndex] ?? '')
                if (!parts) return ''
                return side === 'left' ? parts[0] : parts[1]
              },
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
  }
})
</script>

<template>
  <div class="w-full relative">
    <div class="w-full mb-4 flex flex-col gap-3">
      <!-- Mobile: stack vertically, Desktop: horizontal -->
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
        <!-- Granularity -->
        <div class="flex flex-col gap-1 sm:shrink-0">
          <label
            for="granularity"
            class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
          >
            {{ $t('package.downloads.granularity') }}
          </label>

          <div
            class="flex items-center px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-accent/30)"
          >
            <select
              id="granularity"
              v-model="selectedGranularity"
              class="w-full bg-bg-subtle font-mono text-sm text-fg outline-none appearance-none"
            >
              <option value="daily">{{ $t('package.downloads.granularity_daily') }}</option>
              <option value="weekly">{{ $t('package.downloads.granularity_weekly') }}</option>
              <option value="monthly">{{ $t('package.downloads.granularity_monthly') }}</option>
              <option value="yearly">{{ $t('package.downloads.granularity_yearly') }}</option>
            </select>
          </div>
        </div>

        <!-- Date range inputs -->
        <div class="grid grid-cols-2 gap-2 flex-1">
          <div class="flex flex-col gap-1">
            <label
              for="startDate"
              class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.downloads.start_date') }}
            </label>
            <div
              class="flex items-center gap-2 px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-accent/30)"
            >
              <span class="i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0" aria-hidden="true" />
              <input
                id="startDate"
                v-model="startDate"
                type="date"
                class="w-full min-w-0 bg-transparent font-mono text-sm text-fg outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label
              for="endDate"
              class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.downloads.end_date') }}
            </label>
            <div
              class="flex items-center gap-2 px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-accent/30)"
            >
              <span class="i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0" aria-hidden="true" />
              <input
                id="endDate"
                v-model="endDate"
                type="date"
                class="w-full min-w-0 bg-transparent font-mono text-sm text-fg outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        <!-- Reset button -->
        <button
          v-if="showResetButton"
          type="button"
          aria-label="Reset date range"
          class="self-end flex items-center justify-center px-2.5 py-1.75 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50 sm:mb-0"
          @click="
            () => {
              hasUserEditedDates = false
              startDate = ''
              endDate = ''
              initDateRangeFromWeekly()
              initDateRangeFallbackClient()
            }
          "
        >
          <span class="i-carbon:reset w-5 h-5 inline-block" aria-hidden="true" />
        </button>
      </div>
    </div>

    <ClientOnly v-if="inModal && chartData.dataset">
      <VueUiXy
        :dataset="chartData.dataset"
        :config="config"
        class="[direction:ltr]"
        :key="chartKey"
      >
        <template #menuIcon="{ isOpen }">
          <span v-if="isOpen" class="i-carbon:close w-6 h-6" aria-hidden="true" />
          <span v-else class="i-carbon:overflow-menu-vertical w-6 h-6" aria-hidden="true" />
        </template>
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
      <template #fallback>
        <div class="min-h-[260px]" />
      </template>
    </ClientOnly>

    <!-- Empty state when no chart data -->
    <div
      v-if="inModal && !chartData.dataset && !pending"
      class="min-h-[260px] flex items-center justify-center text-fg-subtle font-mono text-sm"
    >
      {{ $t('package.downloads.no_data') }}
    </div>

    <div
      v-if="pending"
      role="status"
      aria-live="polite"
      class="absolute top-1/2 inset-is-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-fg-subtle font-mono bg-bg/70 backdrop-blur px-3 py-2 rounded-md border border-border"
    >
      {{ $t('package.downloads.loading') }}
    </div>
  </div>
</template>

<style>
.vue-ui-pen-and-paper-actions {
  background: var(--bg-elevated) !important;
}

.vue-ui-pen-and-paper-action {
  background: var(--bg-elevated) !important;
  border: none !important;
}

.vue-ui-pen-and-paper-action:hover {
  background: var(--bg-elevated) !important;
  box-shadow: none !important;
}
</style>
