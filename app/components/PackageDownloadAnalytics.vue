<script setup lang="ts">
import { ref, computed, shallowRef, watch } from 'vue'
import type { VueUiXyDatasetItem } from 'vue-data-ui'
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import { useDebounceFn } from '@vueuse/core'

const {
  weeklyDownloads,
  inModal = false,
  packageName,
  createdIso,
} = defineProps<{
  weeklyDownloads: WeeklyDownloadPoint[]
  inModal?: boolean
  packageName: string
  createdIso: string | null
}>()

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
          name: packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: '#8A8A8A',
        },
      ],
      dates: dataset.map(d => `${d.weekStart}\nto ${d.weekEnd}`),
    }
  }
  if (selectedGranularity === 'daily' && isDailyDataset(dataset)) {
    return {
      dataset: [
        {
          name: packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: '#8A8A8A',
        },
      ],
      dates: dataset.map(d => d.day),
    }
  }
  if (selectedGranularity === 'monthly' && isMonthlyDataset(dataset)) {
    return {
      dataset: [
        {
          name: packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: '#8A8A8A',
        },
      ],
      dates: dataset.map(d => d.month),
    }
  }
  if (selectedGranularity === 'yearly' && isYearlyDataset(dataset)) {
    return {
      dataset: [
        {
          name: packageName,
          type: 'line',
          series: dataset.map(d => d.downloads),
          color: '#8A8A8A',
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

/**
 * Two-phase state:
 * - selectedGranularity: immediate UI
 * - displayedGranularity: only updated once data is ready
 */
const selectedGranularity = ref<ChartTimeGranularity>('weekly')
const displayedGranularity = ref<ChartTimeGranularity>('weekly')

/**
 * Date range inputs.
 * They are initialized from the current effective range:
 * - weekly: from weeklyDownloads first -> weekStart/weekEnd
 * - fallback: last 30 days ending yesterday (client-side)
 */
const startDate = ref<string>('') // YYYY-MM-DD
const endDate = ref<string>('') // YYYY-MM-DD
const hasUserEditedDates = ref(false)

function initDateRangeFromWeekly() {
  if (hasUserEditedDates.value) return
  if (!weeklyDownloads?.length) return

  const first = weeklyDownloads[0]
  const last = weeklyDownloads[weeklyDownloads.length - 1]
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
  () => weeklyDownloads,
  () => {
    initDateRangeFromWeekly()
    initDateRangeFallbackClient()
  },
  { immediate: true },
)

const initialStartDate = ref<string>('') // YYYY-MM-DD
const initialEndDate = ref<string>('') // YYYY-MM-DD

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

const evolution = ref<EvolutionData>(weeklyDownloads)
const pending = ref(false)

let lastRequestKey = ''
let requestToken = 0

const debouncedLoad = useDebounceFn(() => {
  load()
}, 1000)

async function load() {
  if (!import.meta.client) return
  if (!inModal) return

  const o = options.value
  const extraBase =
    o.granularity === 'week'
      ? `w:${String(o.weeks ?? '')}`
      : o.granularity === 'month'
        ? `m:${String(o.months ?? '')}`
        : ''

  const startKey = (o as any).startDate ?? ''
  const endKey = (o as any).endDate ?? ''
  const requestKey = `${packageName}|${createdIso ?? ''}|${o.granularity}|${extraBase}|${startKey}|${endKey}`

  if (requestKey === lastRequestKey) return
  lastRequestKey = requestKey

  const hasExplicitRange = Boolean((o as any).startDate || (o as any).endDate)
  if (o.granularity === 'week' && weeklyDownloads?.length && !hasExplicitRange) {
    evolution.value = weeklyDownloads
    pending.value = false
    displayedGranularity.value = 'weekly'
    return
  }

  pending.value = true
  const currentToken = ++requestToken

  try {
    const result = await fetchPackageDownloadEvolution(
      () => packageName,
      () => createdIso,
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
  () => inModal,
  () => {
    // modal open/close should be immediate
    load()
  },
  { immediate: true },
)

watch(
  () => [
    packageName,
    createdIso,
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
  if (displayedGranularity.value === 'weekly' && weeklyDownloads?.length) {
    if (isWeeklyDataset(evolution.value) && evolution.value.length) return evolution.value
    return weeklyDownloads
  }
  return evolution.value
})

const chartData = computed<{ dataset: VueUiXyDatasetItem[] | null; dates: string[] }>(() => {
  return formatXyDataset(displayedGranularity.value, effectiveData.value)
})

const formatter = ({ value }: { value: number }) => formatCompactNumber(value, { decimals: 1 })

const config = computed(() => ({
  theme: 'dark',
  chart: {
    userOptions: {
      buttons: {
        pdf: false,
        labels: false,
        fullscreen: false,
        table: false,
        tooltip: false,
      },
    },
    backgroundColor: '#0A0A0A', // current default dark mode theme,
    grid: {
      labels: {
        axis: {
          yLabel: `${selectedGranularity.value} downloads`,
          xLabel: packageName,
          yLabelOffsetX: 12,
          fontSize: 24,
        },
        xAxisLabels: {
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
      borderColor: '#2A2A2A',
      customFormat: ({
        absoluteIndex,
        datapoint,
      }: {
        absoluteIndex: number
        datapoint: Record<string, any>
      }) => {
        if (!datapoint) return ''
        const displayValue = formatter({ value: datapoint[0]?.value ?? 0 })
        return `<div class="flex flex-col font-mono text-xs p-3">
          <span class="text-fg-subtle">${chartData.value?.dates[absoluteIndex]}</span>
          <span class="text-xl">${displayValue}</span>
        </div>
        `
      },
    },
    zoom: {
      highlightColor: '#2A2A2A',
      minimap: {
        show: true,
        lineColor: '#FAFAFA',
        selectedColorOpacity: 0.1,
        frameColor: '#3A3A3A',
      },
      preview: {
        fill: '#FAFAFA05',
        strokeWidth: 1,
        strokeDasharray: 3,
      },
    },
  },
}))
</script>

<template>
  <div class="w-full relative">
    <div class="w-full mb-2 flex flex-col gap-2">
      <div class="w-full grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
        <div class="flex gap-2">
          <!-- Granularity -->
          <div class="flex flex-col gap-1">
            <label
              for="granularity"
              class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
            >
              Granularity
            </label>

            <div
              class="flex items-center px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-fg/50)"
            >
              <select
                id="granularity"
                v-model="selectedGranularity"
                class="w-full bg-transparent font-mono text-sm text-fg outline-none"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <!-- Date range inputs -->
          <div class="grid grid-cols-2 gap-2">
            <div class="flex flex-col gap-1">
              <label
                for="startDate"
                class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
              >
                Start
              </label>
              <div
                class="flex items-center gap-2 px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-fg/50)"
              >
                <span class="i-carbon-calendar w-4 h-4 text-fg-subtle" aria-hidden="true" />
                <input
                  id="startDate"
                  v-model="startDate"
                  type="date"
                  class="w-full bg-transparent font-mono text-sm text-fg outline-none [color-scheme:dark]"
                />
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label
                for="endDate"
                class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
              >
                End
              </label>
              <div
                class="flex items-center gap-2 px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-fg/50)"
              >
                <span class="i-carbon-calendar w-4 h-4 text-fg-subtle" aria-hidden="true" />
                <input
                  id="endDate"
                  v-model="endDate"
                  type="date"
                  class="w-full bg-transparent font-mono text-sm text-fg outline-none [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
          <!-- Reset -->
          <div class="flex flex-col gap-1">
            <!-- spacer label to align with others -->
            <div class="font-mono tracking-wide uppercase invisible">Reset</div>

            <button
              v-if="showResetButton"
              type="button"
              title="Reset date range"
              class="flex items-center justify-center px-2.5 py-1.75 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fg/50"
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
              <span class="i-carbon-reset w-5 h-5 inline-block" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <ClientOnly v-if="inModal">
      <VueUiXy :dataset="chartData.dataset" :config="config">
        <template #menuIcon="{ isOpen }">
          <span class="i-carbon-close w-6 h-6" v-if="isOpen" />
          <span class="i-carbon-overflow-menu-vertical w-6 h-6" v-else />
        </template>
        <template #optionCsv>
          <span class="i-carbon-csv w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>
        <template #optionImg>
          <span class="i-carbon-png w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>
        <template #optionSvg>
          <span class="i-carbon-svg w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>

        <template #annotator-action-close>
          <span class="i-carbon-close w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>
        <template #annotator-action-color="{ color }">
          <span class="i-carbon-color-palette w-6 h-6" :style="{ color }" />
        </template>
        <template #annotator-action-undo="{ disabled }">
          <span class="i-carbon-undo w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>
        <template #annotator-action-redo="{ disabled }">
          <span class="i-carbon-redo w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>
        <template #annotator-action-delete="{ disabled }">
          <span class="i-carbon-trash-can w-6 h-6 text-fg-subtle" style="pointer-events: none" />
        </template>
        <template #optionAnnotator="{ isAnnotator }">
          <span
            class="i-carbon-edit-off w-6 h-6 text-fg-subtle"
            style="pointer-events: none"
            v-if="isAnnotator"
          />
          <span class="i-carbon-edit w-6 h-6 text-fg-subtle" style="pointer-events: none" v-else />
        </template>
      </VueUiXy>
      <template #fallback>
        <div class="min-h-[260px]" />
      </template>
    </ClientOnly>

    <div
      v-if="pending"
      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-fg-subtle font-mono bg-bg/70 backdrop-blur px-3 py-2 rounded-md border border-border"
    >
      Loading…
    </div>
  </div>
</template>

<style>
.vue-ui-pen-and-paper-actions {
  background: #1a1a1a !important;
}

.vue-ui-pen-and-paper-action {
  background: #1a1a1a !important;
  border: none !important;
}

.vue-ui-pen-and-paper-action:hover {
  background: #2a2a2a !important;
}

.vue-data-ui-zoom {
  max-width: 500px;
  margin: 0 auto;
}
</style>
