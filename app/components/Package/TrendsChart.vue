<script setup lang="ts">
import type { VueUiXyDatasetItem } from 'vue-data-ui'
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import { useDebounceFn, useElementSize } from '@vueuse/core'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch } from '~/utils/colors'
import { getFrameworkColor, isListedFramework } from '~/utils/frameworks'

const props = defineProps<{
  // For single package downloads history
  weeklyDownloads?: WeeklyDataPoint[]
  inModal?: boolean

  /**
   * Backward compatible single package mode.
   * Used when `weeklyDownloads` is provided.
   */
  packageName?: string

  /**
   * Multi-package mode.
   * Used when `weeklyDownloads` is not provided.
   */
  packageNames?: string[]
  createdIso?: string | null

  /** When true, shows facet selector (e.g. Downloads / Likes). */
  showFacetSelector?: boolean
}>()

const { locale } = useI18n()
const { accentColors, selectedAccentColor } = useAccentColor()
const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const isZoomed = shallowRef(false)

function setIsZoom({ isZoom }: { isZoom: boolean }) {
  isZoomed.value = isZoom
}

const { width } = useElementSize(rootEl)

const compactNumberFormatter = useCompactNumberFormatter()

onMounted(async () => {
  rootEl.value = document.documentElement
  resolvedMode.value = colorMode.value === 'dark' ? 'dark' : 'light'

  initDateRangeFromWeekly()
  initDateRangeForMultiPackageWeekly52()
  initDateRangeFallbackClient()

  await nextTick()
  isMounted.value = true

  loadMetric(selectedMetric.value)
})

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

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

type ChartTimeGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly'
const DEFAULT_GRANULARITY: ChartTimeGranularity = 'weekly'
type EvolutionData = DailyDataPoint[] | WeeklyDataPoint[] | MonthlyDataPoint[] | YearlyDataPoint[]

type DateRangeFields = {
  startDate?: string
  endDate?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isWeeklyDataset(data: unknown): data is WeeklyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'weekStart' in data[0] &&
    'weekEnd' in data[0] &&
    'value' in data[0]
  )
}
function isDailyDataset(data: unknown): data is DailyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'day' in data[0] &&
    'value' in data[0]
  )
}
function isMonthlyDataset(data: unknown): data is MonthlyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'month' in data[0] &&
    'value' in data[0]
  )
}
function isYearlyDataset(data: unknown): data is YearlyDataPoint[] {
  return (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0]) &&
    'year' in data[0] &&
    'value' in data[0]
  )
}

/**
 * Formats a single evolution dataset into the structure expected by `VueUiXy`
 * for single-series charts.
 *
 * The dataset is interpreted based on the selected time granularity:
 * - **daily**   → uses `timestamp`
 * - **weekly**  → uses `timestampEnd`
 * - **monthly** → uses `timestamp`
 * - **yearly**  → uses `timestamp`
 *
 * Only datasets matching the expected shape for the given granularity are
 * accepted. If the dataset does not match, an empty result is returned.
 *
 * The returned structure includes:
 * - a single line-series dataset with a consistent color
 * - a list of timestamps used as the x-axis values
 *
 * @param selectedGranularity - Active chart time granularity
 * @param dataset - Raw evolution dataset to format
 * @param seriesName - Display name for the resulting series
 * @returns An object containing a formatted dataset and its associated dates,
 *          or `{ dataset: null, dates: [] }` when the input is incompatible
 */
function formatXyDataset(
  selectedGranularity: ChartTimeGranularity,
  dataset: EvolutionData,
  seriesName: string,
): { dataset: VueUiXyDatasetItem[] | null; dates: number[] } {
  if (selectedGranularity === 'weekly' && isWeeklyDataset(dataset)) {
    return {
      dataset: [
        {
          name: seriesName,
          type: 'line',
          series: dataset.map(d => d.value),
          color: accent.value,
          useArea: true,
        },
      ],
      dates: dataset.map(d => d.timestampEnd),
    }
  }
  if (selectedGranularity === 'daily' && isDailyDataset(dataset)) {
    return {
      dataset: [
        {
          name: seriesName,
          type: 'line',
          series: dataset.map(d => d.value),
          color: accent.value,
          useArea: true,
        },
      ],
      dates: dataset.map(d => d.timestamp),
    }
  }
  if (selectedGranularity === 'monthly' && isMonthlyDataset(dataset)) {
    return {
      dataset: [
        {
          name: seriesName,
          type: 'line',
          series: dataset.map(d => d.value),
          color: accent.value,
          useArea: true,
        },
      ],
      dates: dataset.map(d => d.timestamp),
    }
  }
  if (selectedGranularity === 'yearly' && isYearlyDataset(dataset)) {
    return {
      dataset: [
        {
          name: seriesName,
          type: 'line',
          series: dataset.map(d => d.value),
          color: accent.value,
          useArea: true,
        },
      ],
      dates: dataset.map(d => d.timestamp),
    }
  }
  return { dataset: null, dates: [] }
}

/**
 * Extracts normalized time-series points from an evolution dataset based on
 * the selected time granularity.
 *
 * Each returned point contains:
 * - `timestamp`: the numeric time value used for x-axis alignment
 * - `value`: the corresponding value at that time
 *
 * The timestamp field is selected according to granularity:
 * - **daily**   → `timestamp`
 * - **weekly**  → `timestampEnd`
 * - **monthly** → `timestamp`
 * - **yearly**  → `timestamp`
 *
 * If the dataset does not match the expected shape for the given granularity,
 * an empty array is returned.
 *
 * This helper is primarily used in multi-package mode to align multiple
 * datasets on a shared time axis.
 *
 * @param selectedGranularity - Active chart time granularity
 * @param dataset - Raw evolution dataset to extract points from
 * @returns An array of normalized `{ timestamp, value }` points
 */
function extractSeriesPoints(
  selectedGranularity: ChartTimeGranularity,
  dataset: EvolutionData,
): Array<{ timestamp: number; value: number }> {
  if (selectedGranularity === 'weekly' && isWeeklyDataset(dataset)) {
    return dataset.map(d => ({ timestamp: d.timestampEnd, value: d.value }))
  }
  if (
    (selectedGranularity === 'daily' && isDailyDataset(dataset)) ||
    (selectedGranularity === 'monthly' && isMonthlyDataset(dataset)) ||
    (selectedGranularity === 'yearly' && isYearlyDataset(dataset))
  ) {
    return (dataset as Array<{ timestamp: number; value: number }>).map(d => ({
      timestamp: d.timestamp,
      value: d.value,
    }))
  }
  return []
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
 * Multi-package mode detection:
 * packageNames has entries, and packageName is not set.
 */
const isMultiPackageMode = computed(() => {
  const names = (props.packageNames ?? []).map(n => String(n).trim()).filter(Boolean)
  const single = String(props.packageName ?? '').trim()
  return names.length > 0 && !single
})

const effectivePackageNames = computed<string[]>(() => {
  if (isMultiPackageMode.value)
    return (props.packageNames ?? []).map(n => String(n).trim()).filter(Boolean)
  const single = String(props.packageName ?? '').trim()
  return single ? [single] : []
})

const selectedGranularity = shallowRef<ChartTimeGranularity>(DEFAULT_GRANULARITY)
const displayedGranularity = shallowRef<ChartTimeGranularity>(DEFAULT_GRANULARITY)

const isEndDateOnPeriodEnd = computed(() => {
  const g = selectedGranularity.value
  if (g !== 'monthly' && g !== 'yearly') return false

  const iso = String(endDate.value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false

  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return false

  // Monthly: endDate is the last day of its month (UTC)
  if (g === 'monthly') {
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return day === lastDayOfMonth
  }

  // Yearly: endDate is the last day of the year (UTC)
  return month === 12 && day === 31
})

const isEstimationGranularity = computed(
  () => displayedGranularity.value === 'monthly' || displayedGranularity.value === 'yearly',
)
const shouldRenderEstimationOverlay = computed(
  () => !pending.value && isEstimationGranularity.value,
)

const startDate = shallowRef<string>('') // YYYY-MM-DD
const endDate = shallowRef<string>('') // YYYY-MM-DD
const hasUserEditedDates = shallowRef(false)

/**
 * Initializes the date range from the provided weeklyDownloads dataset.
 *
 * The range is inferred directly from the dataset boundaries:
 * - `startDate` is set from the `weekStart` of the first entry
 * - `endDate` is set from the `weekEnd` of the last entry
 *
 * Dates are normalized to `YYYY-MM-DD` and validated before assignment.
 *
 * This function is a no-op when:
 * - the user has already edited the date range
 * - no weekly download data is available
 *
 * The inferred range takes precedence over client-side fallbacks but does not
 * override user-defined dates.
 */
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

/**
 * Initializes a default date range on the client when no explicit dates
 * have been provided and the user has not manually edited the range, typically
 * when weeklyDownloads is not provided.
 *
 * The range is computed in UTC to avoid timezone-related off-by-one errors:
 * - `endDate` is set to yesterday (UTC)
 * - `startDate` is set to 29 days before yesterday (UTC), yielding a 30-day range
 *
 * This function is a no-op when:
 * - the user has already edited the date range
 * - the code is running on the server
 * - both `startDate` and `endDate` are already defined
 */
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

function toUtcDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

/**
 * Initializes a default date range for multi-package mode using a fixed
 * 52-week rolling window.
 *
 * The range is computed in UTC to ensure consistent boundaries across
 * timezones:
 * - `endDate` is set to yesterday (UTC)
 * - `startDate` is set to the first day of the 52-week window ending yesterday
 *
 * This function is intended for multi-package comparisons where no explicit
 * date range or dataset-derived range is available.
 *
 * This function is a no-op when:
 * - the user has already edited the date range
 * - the code is running on the server
 * - the component is not in multi-package mode
 * - both `startDate` and `endDate` are already defined
 */
function initDateRangeForMultiPackageWeekly52() {
  if (hasUserEditedDates.value) return
  if (!import.meta.client) return
  if (!isMultiPackageMode.value) return
  if (startDate.value && endDate.value) return

  const today = new Date()
  const yesterday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  )

  endDate.value = toUtcDateOnly(yesterday)
  startDate.value = toUtcDateOnly(addUtcDays(yesterday, -(52 * 7) + 1))
}

watch(
  () => (props.packageNames ?? []).length,
  () => {
    initDateRangeForMultiPackageWeekly52()
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
    if (startDate.value || endDate.value) hasUserEditedDates.value = true
    setInitialRangeIfEmpty()
  },
  { immediate: true, flush: 'post' },
)

const showResetButton = computed(() => {
  if (!initialStartDate.value && !initialEndDate.value) return false
  return startDate.value !== initialStartDate.value || endDate.value !== initialEndDate.value
})

function resetDateRange() {
  hasUserEditedDates.value = false
  startDate.value = ''
  endDate.value = ''
  initDateRangeFromWeekly()
  initDateRangeForMultiPackageWeekly52()
  initDateRangeFallbackClient()
}

const options = shallowRef<
  | { granularity: 'day'; startDate?: string; endDate?: string }
  | { granularity: 'week'; weeks: number; startDate?: string; endDate?: string }
  | {
      granularity: 'month'
      months: number
      startDate?: string
      endDate?: string
    }
  | { granularity: 'year'; startDate?: string; endDate?: string }
>({ granularity: 'week', weeks: 52 })

/**
 * Applies the current date range (`startDate` / `endDate`) to a base options
 * object, returning a new object augmented with validated date fields.
 *
 * Dates are normalized to `YYYY-MM-DD`, validated, and ordered to ensure
 * logical consistency:
 * - When both dates are valid, the earliest is assigned to `startDate` and
 *   the latest to `endDate`
 * - When only one valid date is present, only that boundary is applied
 * - Invalid or empty dates are omitted from the result
 *
 * The input object is not mutated.
 *
 * @typeParam T - Base options type to extend with date range fields
 * @param base - Base options object to which the date range should be applied
 * @returns A new options object including the applicable `startDate` and/or
 *          `endDate` fields
 */
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

const { fetchPackageDownloadEvolution, fetchPackageLikesEvolution } = useCharts()

type MetricId = 'downloads' | 'likes'
const DEFAULT_METRIC_ID: MetricId = 'downloads'

type MetricDef = {
  id: MetricId
  label: string
  fetch: (pkg: string, options: EvolutionOptions) => Promise<EvolutionData>
}

const METRICS = computed<MetricDef[]>(() => [
  {
    id: 'downloads',
    label: $t('package.trends.items.downloads'),
    fetch: (pkg, opts) =>
      fetchPackageDownloadEvolution(pkg, props.createdIso ?? null, opts) as Promise<EvolutionData>,
  },
  {
    id: 'likes',
    label: $t('package.trends.items.likes'),
    fetch: (pkg, opts) => fetchPackageLikesEvolution(pkg, opts) as Promise<EvolutionData>,
  },
])

const selectedMetric = shallowRef<MetricId>(DEFAULT_METRIC_ID)

// Per-metric state keyed by metric id
const metricStates = reactive<
  Record<
    MetricId,
    {
      pending: boolean
      evolution: EvolutionData
      evolutionsByPackage: Record<string, EvolutionData>
      requestToken: number
    }
  >
>({
  downloads: {
    pending: false,
    evolution: props.weeklyDownloads ?? [],
    evolutionsByPackage: {},
    requestToken: 0,
  },
  likes: {
    pending: false,
    evolution: [],
    evolutionsByPackage: {},
    requestToken: 0,
  },
})

const activeMetricState = computed(() => metricStates[selectedMetric.value])
const activeMetricDef = computed(() => METRICS.value.find(m => m.id === selectedMetric.value)!)
const pending = computed(() => activeMetricState.value.pending)

const isMounted = shallowRef(false)

// Watches granularity and date inputs to keep request options in sync and
// manage the loading state.
//
// This watcher does NOT perform the fetch itself. Its responsibilities are:
// - derive the correct API options from the selected granularity
// - apply the current validated date range to those options
// - determine whether a loading indicator should be shown
//
// Fetching is debounced separately to avoid excessive
// network requests while the user is interacting with controls.
watch(
  [selectedGranularity, startDate, endDate],
  ([granularityValue]) => {
    if (granularityValue === 'daily') options.value = applyDateRange({ granularity: 'day' })
    else if (granularityValue === 'weekly')
      options.value = applyDateRange({ granularity: 'week', weeks: 52 })
    else if (granularityValue === 'monthly')
      options.value = applyDateRange({ granularity: 'month', months: 24 })
    else options.value = applyDateRange({ granularity: 'year' })

    // Do not set pending during initial setup
    if (!isMounted.value) return

    const packageNames = effectivePackageNames.value
    if (!import.meta.client || !packageNames.length) {
      activeMetricState.value.pending = false
      return
    }

    const o = options.value
    const hasExplicitRange = ('startDate' in o && o.startDate) || ('endDate' in o && o.endDate)

    // Do not show loading when weeklyDownloads is already provided
    if (
      selectedMetric.value === DEFAULT_METRIC_ID &&
      !isMultiPackageMode.value &&
      granularityValue === DEFAULT_GRANULARITY &&
      props.weeklyDownloads?.length &&
      !hasExplicitRange
    ) {
      activeMetricState.value.pending = false
      return
    }

    activeMetricState.value.pending = true
  },
  { immediate: true },
)

/**
 * Fetches evolution data for a given metric based on the current granularity,
 * date range, and package selection.
 *
 * This function:
 * - runs only on the client
 * - supports both single-package and multi-package modes
 * - applies request de-duplication via a request token to avoid race conditions
 * - updates the appropriate reactive stores with fetched data
 * - manages the metric's `pending` loading state
 */
async function loadMetric(metricId: MetricId) {
  if (!import.meta.client) return

  const packageNames = effectivePackageNames.value
  if (!packageNames.length) return

  const state = metricStates[metricId]
  const metric = METRICS.value.find(m => m.id === metricId)!
  const currentToken = ++state.requestToken
  state.pending = true

  const fetchFn = (pkg: string) => metric.fetch(pkg, options.value)

  try {
    if (isMultiPackageMode.value) {
      const settled = await Promise.allSettled(
        packageNames.map(async pkg => {
          const result = await fetchFn(pkg)
          return { pkg, result: (result ?? []) as EvolutionData }
        }),
      )

      if (currentToken !== state.requestToken) return

      const next: Record<string, EvolutionData> = {}
      for (const entry of settled) {
        if (entry.status === 'fulfilled') next[entry.value.pkg] = entry.value.result
      }

      state.evolutionsByPackage = next
      displayedGranularity.value = selectedGranularity.value
      return
    }

    const pkg = packageNames[0] ?? ''
    if (!pkg) {
      state.evolution = []
      displayedGranularity.value = selectedGranularity.value
      return
    }

    // In single-package mode the parent already fetches weekly downloads for the
    // sparkline (WeeklyDownloadStats). When the user hasn't customised the date
    // range we can reuse that prop directly and skip a redundant API call.
    if (metricId === DEFAULT_METRIC_ID) {
      const o = options.value
      const hasExplicitRange = ('startDate' in o && o.startDate) || ('endDate' in o && o.endDate)
      if (
        selectedGranularity.value === DEFAULT_GRANULARITY &&
        props.weeklyDownloads?.length &&
        !hasExplicitRange
      ) {
        state.evolution = props.weeklyDownloads
        displayedGranularity.value = DEFAULT_GRANULARITY
        return
      }
    }

    const result = await fetchFn(pkg)
    if (currentToken !== state.requestToken) return

    state.evolution = (result ?? []) as EvolutionData
    displayedGranularity.value = selectedGranularity.value
  } catch {
    if (currentToken !== state.requestToken) return
    if (isMultiPackageMode.value) state.evolutionsByPackage = {}
    else state.evolution = []
  } finally {
    if (currentToken === state.requestToken) state.pending = false
  }
}

// Debounced wrapper around `loadNow` to avoid triggering a network request
// on every intermediate state change while the user is interacting with inputs
//
// This 'arbitrary' 1000 ms delay:
// - gives enough time for the user to finish changing granularity or dates
// - prevents unnecessary API load and visual flicker of the loading state
//
const debouncedLoadNow = useDebounceFn(() => {
  loadMetric(selectedMetric.value)
}, 1000)

const fetchTriggerKey = computed(() => {
  const names = effectivePackageNames.value.join(',')
  const o = options.value
  return [
    isMultiPackageMode.value ? 'M' : 'S',
    names,
    String(props.createdIso ?? ''),
    String(o.granularity ?? ''),
    String('weeks' in o ? (o.weeks ?? '') : ''),
    String('months' in o ? (o.months ?? '') : ''),
    String('startDate' in o ? (o.startDate ?? '') : ''),
    String('endDate' in o ? (o.endDate ?? '') : ''),
  ].join('|')
})

watch(
  () => fetchTriggerKey.value,
  () => {
    if (!import.meta.client) return
    if (!isMounted.value) return
    debouncedLoadNow()
  },
  { flush: 'post' },
)

const effectiveDataSingle = computed<EvolutionData>(() => {
  const state = activeMetricState.value
  if (
    selectedMetric.value === DEFAULT_METRIC_ID &&
    displayedGranularity.value === DEFAULT_GRANULARITY &&
    props.weeklyDownloads?.length
  ) {
    if (isWeeklyDataset(state.evolution) && state.evolution.length) return state.evolution
    return props.weeklyDownloads
  }
  return state.evolution
})

/**
 * Normalized chart data derived from the active metric's evolution datasets.
 *
 * Adapts its behavior based on the current mode:
 * - **Single-package mode**: formats via `formatXyDataset`
 * - **Multi-package mode**: merges datasets into a shared time axis

 * The returned structure matches the expectations of `VueUiXy`:
 * - `dataset`: array of series definitions, or `null` when no data is available
 * - `dates`: sorted list of timestamps used as the x-axis reference
 *
 * Returning `dataset: null` explicitly signals the absence of data and allows
 * the template to handle empty states without ambiguity.
 */
const chartData = computed<{
  dataset: VueUiXyDatasetItem[] | null
  dates: number[]
}>(() => {
  if (!isMultiPackageMode.value) {
    const pkg = effectivePackageNames.value[0] ?? props.packageName ?? ''
    return formatXyDataset(displayedGranularity.value, effectiveDataSingle.value, pkg)
  }

  const state = activeMetricState.value
  const names = effectivePackageNames.value
  const granularity = displayedGranularity.value

  const timestampSet = new Set<number>()
  const pointsByPackage = new Map<string, Array<{ timestamp: number; value: number }>>()

  for (const pkg of names) {
    const data = state.evolutionsByPackage[pkg] ?? []
    const points = extractSeriesPoints(granularity, data)
    pointsByPackage.set(pkg, points)
    for (const p of points) timestampSet.add(p.timestamp)
  }

  const dates = Array.from(timestampSet).sort((a, b) => a - b)
  if (!dates.length) return { dataset: null, dates: [] }

  const dataset: VueUiXyDatasetItem[] = names.map(pkg => {
    const points = pointsByPackage.get(pkg) ?? []
    const map = new Map<number, number>()
    for (const p of points) map.set(p.timestamp, p.value)

    const series = dates.map(t => map.get(t) ?? 0)

    const item: VueUiXyDatasetItem = {
      name: pkg,
      type: 'line',
      series,
    } as VueUiXyDatasetItem

    if (isListedFramework(pkg)) {
      item.color = getFrameworkColor(pkg)
    }
    return item
  })

  return { dataset, dates }
})

const normalisedDataset = computed(() => {
  return chartData.value.dataset?.map(d => {
    return {
      ...d,
      series: [...d.series.slice(0, -1), extrapolateLastValue(d.series.at(-1) ?? 0)],
    }
  })
})

const maxDatapoints = computed(() =>
  Math.max(0, ...(chartData.value.dataset ?? []).map(d => d.series.length)),
)

const loadFile = (link: string, filename: string) => {
  const a = document.createElement('a')
  a.href = link
  a.download = filename
  a.click()
  a.remove()
}

const datetimeFormatterOptions = computed(() => {
  return {
    daily: { year: 'yyyy-MM-dd', month: 'yyyy-MM-dd', day: 'yyyy-MM-dd' },
    weekly: { year: 'yyyy-MM-dd', month: 'yyyy-MM-dd', day: 'yyyy-MM-dd' },
    monthly: { year: 'MMM yyyy', month: 'MMM yyyy', day: 'MMM yyyy' },
    yearly: { year: 'yyyy', month: 'yyyy', day: 'yyyy' },
  }[selectedGranularity.value]
})

const sanitise = (value: string) =>
  value
    .replace(/^@/, '')
    .replace(/[\\/:"*?<>|]/g, '-')
    .replace(/\//g, '-')

function buildExportFilename(extension: string): string {
  const g = selectedGranularity.value
  const range = `${startDate.value}_${endDate.value}`

  if (!isMultiPackageMode.value) {
    const name = effectivePackageNames.value[0] ?? props.packageName ?? 'package'
    return `${sanitise(name)}-${g}_${range}.${extension}`
  }

  const names = effectivePackageNames.value
  const label = names.length === 1 ? names[0] : names.join('_')
  return `${sanitise(label ?? '')}-${g}_${range}.${extension}`
}

const granularityLabels = computed(() => ({
  daily: $t('package.trends.granularity_daily'),
  weekly: $t('package.trends.granularity_weekly'),
  monthly: $t('package.trends.granularity_monthly'),
  yearly: $t('package.trends.granularity_yearly'),
}))

function getGranularityLabel(granularity: ChartTimeGranularity) {
  return granularityLabels.value[granularity]
}

function clampRatio(value: number): number {
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/**
 * Convert a `YYYY-MM-DD` date to UTC timestamp representing the end of that day.
 * The returned timestamp corresponds to `23:59:59.999` in UTC
 *
 * @param endDateOnly - ISO-like date string (`YYYY-MM-DD`)
 * @returns The UTC timestamp in milliseconds for the end of the given day,
 * or `null` if the input is invalid.
 */
function endDateOnlyToUtcMs(endDateOnly: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endDateOnly)) return null
  const [y, m, d] = endDateOnly.split('-').map(Number)
  if (!y || !m || !d) return null
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999)
}

/**
 * Computes the UTC timestamp corresponding to the start of the time bucket
 * that contains the given timestamp.
 *
 * This function is used to derive period boundaries when computing completion
 * ratios or extrapolating values for partially completed periods.
 *
 * Bucket boundaries are defined in UTC:
 * - **monthly** : first day of the month at `00:00:00.000` UTC
 * - **yearly** : January 1st of the year at `00:00:00.000` UTC
 *
 * @param timestampMs - Reference timestamp in milliseconds
 * @param granularity - Bucket granularity (`monthly` or `yearly`)
 * @returns The UTC timestamp representing the start of the corresponding
 * time bucket.
 */
function getBucketStartUtc(timestampMs: number, granularity: 'monthly' | 'yearly'): number {
  const date = new Date(timestampMs)
  if (granularity === 'yearly') return Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)
}

/**
 * Computes the UTC timestamp corresponding to the end of the time
 * bucket that contains the given timestamp. This end timestamp is paired with `getBucketStartUtc` to define
 * a half-open interval `[start, end)` when computing elapsed time or completion
 * ratios within a period.
 *
 * Bucket boundaries are defined in UTC and are **exclusive**:
 * - **monthly** : first day of the following month at `00:00:00.000` UTC
 * - **yearly** : January 1st of the following year at `00:00:00.000` UTC
 *
 * @param timestampMs - Reference timestamp in milliseconds
 * @param granularity - Bucket granularity (`monthly` or `yearly`)
 * @returns The UTC timestamp (in milliseconds) representing the exclusive end
 * of the corresponding time bucket.
 */
function getBucketEndUtc(timestampMs: number, granularity: 'monthly' | 'yearly'): number {
  const date = new Date(timestampMs)
  if (granularity === 'yearly') return Date.UTC(date.getUTCFullYear() + 1, 0, 1, 0, 0, 0, 0)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)
}

/**
 * Computes the completion ratio of a time bucket relative to a reference time.
 *
 * The ratio represents how much of the bucket’s duration has elapsed at
 * `referenceMs`, expressed as a normalized value in the range `[0, 1]`.
 *
 * The bucket is defined by the calendar period (monthly or yearly) that
 * contains `bucketTimestampMs`, using UTC boundaries:
 * - start: `getBucketStartUtc(...)`
 * - end: `getBucketEndUtc(...)`
 *
 * The returned value is clamped to `[0, 1]`:
 * - `0`: reference time is at or before the start of the bucket
 * - `1`: reference time is at or after the end of the bucket
 *
 * This function is used to detect partially completed periods and to
 * extrapolate full period values from partial data.
 *
 * @param params.bucketTimestampMs - Timestamp belonging to the bucket
 * @param params.granularity - Bucket granularity (`monthly` or `yearly`)
 * @param params.referenceMs - Reference timestamp used to measure progress
 * @returns A normalized completion ratio in the range `[0, 1]`.
 */
function getCompletionRatioForBucket(params: {
  bucketTimestampMs: number
  granularity: 'monthly' | 'yearly'
  referenceMs: number
}): number {
  const start = getBucketStartUtc(params.bucketTimestampMs, params.granularity)
  const end = getBucketEndUtc(params.bucketTimestampMs, params.granularity)
  const total = end - start
  if (total <= 0) return 1
  return clampRatio((params.referenceMs - start) / total)
}

/**
 * Extrapolate the last observed value of a time series when the last bucket
 * (month or year) is only partially complete.
 *
 * This is used to replace the final value in each `VueUiXy` series
 * before rendering, so the chart can display an estimated full-period value
 * for the current month or year.
 *
 * Notes:
 * - This function assumes `lastValue` is the value corresponding to the last
 *   date in `chartData.value.dates`
 *
 * @param lastValue - The last observed numeric value for a series.
 * @returns The extrapolated value for partially completed monthly or yearly granularities,
 * or the original `lastValue` when no extrapolation should be applied.
 */
function extrapolateLastValue(lastValue: number) {
  if (displayedGranularity.value !== 'monthly' && displayedGranularity.value !== 'yearly')
    return lastValue

  const endDateMs = endDate.value ? endDateOnlyToUtcMs(endDate.value) : null
  const referenceMs = endDateMs ?? Date.now()

  const completionRatio = getCompletionRatioForBucket({
    bucketTimestampMs: chartData.value.dates.at(-1) ?? 0,
    granularity: displayedGranularity.value,
    referenceMs,
  })

  if (!(completionRatio > 0 && completionRatio < 1)) return lastValue

  const extrapolatedValue = lastValue / completionRatio
  if (!Number.isFinite(extrapolatedValue)) return lastValue

  return extrapolatedValue
}

/**
 * Build and return svg markup for estimation overlays on the chart.
 *
 * This function is used in the `#svg` slot of `VueUiXy` to draw a dashed line
 * between the last datapoint and its ancestor, for partial month or year.
 *
 * The function returns an empty string when:
 * - estimation overlays are disabled
 * - no valid series or datapoints are available
 *
 * @param svg - svg context object provided by `VueUiXy` via the `#svg` slot
 * @returns A string containing SVG elements to be injected, or an empty string
 * when no estimation overlay should be rendered.
 */
function drawEstimationLine(svg: Record<string, any>) {
  if (!shouldRenderEstimationOverlay.value) return ''

  const data = Array.isArray(svg?.data) ? svg.data : []
  if (!data.length) return ''

  // Collect per-series estimates and a global max candidate for the y-axis
  const lines: string[] = []

  for (const serie of data) {
    const plots = serie?.plots
    if (!Array.isArray(plots) || plots.length < 2) continue

    const previousPoint = plots.at(-2)
    const lastPoint = plots.at(-1)
    if (!previousPoint || !lastPoint) continue

    const stroke = String(serie?.color ?? colors.value.fg)

    /**
     * The following svg elements are injected in the #svg slot of VueUiXy:
     * - a line overlay covering the plain path bewteen the last datapoint and its ancestor
     * - a dashed line connecting the last datapoint to its ancestor
     * - a circle for the last datapoint
     */

    lines.push(`
      <line
        x1="${previousPoint.x}" 
        y1="${previousPoint.y}" 
        x2="${lastPoint.x}" 
        y2="${lastPoint.y}" 
        stroke="${colors.value.bg}" 
        stroke-width="3"
        opacity="1"
      />
      <line 
        x1="${previousPoint.x}" 
        y1="${previousPoint.y}" 
        x2="${lastPoint.x}" 
        y2="${lastPoint.y}" 
        stroke="${stroke}" 
        stroke-width="3"
        stroke-dasharray="4 8"
        stroke-linecap="round"
      />
      <circle
        cx="${lastPoint.x}"
        cy="${lastPoint.y}"
        r="4"
        fill="${stroke}"
        stroke="${colors.value.bg}"
        stroke-width="2"
      />
    `)
  }

  if (!lines.length) return ''

  return lines.join('\n')
}

/**
 * Build and return svg text label for the last datapoint of each series.
 *
 * This function is used in the `#svg` slot of `VueUiXy` to render a value label
 * next to the final datapoint of each series when the data represents fully
 * completed periods (for example, daily or weekly granularities).
 *
 * For each series:
 * - retrieves the last plotted point
 * - renders a text label slightly offset to the right of the point
 * - formats the value using the compact number formatter
 *
 * Return an empty string when no series data is available.
 *
 * @param svg - SVG context object provided by `VueUiXy` via the `#svg` slot
 * @returns A string containing SVG `<text>` elements, or an empty string when
 * no labels should be rendered.
 */
function drawLastDatapointLabel(svg: Record<string, any>) {
  const data = Array.isArray(svg?.data) ? svg.data : []
  if (!data.length) return ''

  const dataLabels: string[] = []

  for (const serie of data) {
    const lastPlot = serie.plots.at(-1)

    dataLabels.push(`
      <text
        text-anchor="start"
        dominant-baseline="middle"
        x="${lastPlot.x + 12}"
        y="${lastPlot.y}"
        font-size="24"
        fill="${colors.value.fg}"
        stroke="${colors.value.bg}"
        stroke-width="1"
        paint-order="stroke fill"
      >
        ${compactNumberFormatter.value.format(Number.isFinite(lastPlot.value) ? lastPlot.value : 0)}
      </text>
    `)
  }

  return dataLabels.join('\n')
}

/**
 * Build and return a legend to be injected during the SVG export only, since the custom legend is
 * displayed as an independant div, content has to be injected within the chart's viewBox.
 *
 * Legend items are displayed in a column, on the top left of the chart.
 */
function drawSvgPrintLegend(svg: Record<string, any>) {
  const data = Array.isArray(svg?.data) ? svg.data : []
  if (!data.length) return ''

  const seriesNames: string[] = []

  data.forEach((serie, index) => {
    seriesNames.push(`
      <rect
        x="${svg.drawingArea.left + 12}"
        y="${svg.drawingArea.top + 24 * index - 7}"
        width="12"
        height="12"
        fill="${serie.color}"
        rx="3"
      />
      <text
        text-anchor="start"
        dominant-baseline="middle"
        x="${svg.drawingArea.left + 32}"
        y="${svg.drawingArea.top + 24 * index}"
        font-size="16"
        fill="${colors.value.fg}"
        stroke="${colors.value.bg}"
        stroke-width="1"
        paint-order="stroke fill"
      >
        ${serie.name}
      </text>
  `)
  })

  // Inject the estimation legend item when necessary
  if (
    ['monthly', 'yearly'].includes(displayedGranularity.value) &&
    !isEndDateOnPeriodEnd.value &&
    !isZoomed.value
  ) {
    seriesNames.push(`
        <line 
          x1="${svg.drawingArea.left + 12}"
          y1="${svg.drawingArea.top + 24 * data.length}"
          x2="${svg.drawingArea.left + 24}"
          y2="${svg.drawingArea.top + 24 * data.length}"
          stroke="${colors.value.fg}"
          stroke-dasharray="4"
          stroke-linecap="round"
        />
        <text
          text-anchor="start"
          dominant-baseline="middle"
          x="${svg.drawingArea.left + 32}"
          y="${svg.drawingArea.top + 24 * data.length}"
          font-size="16"
          fill="${colors.value.fg}"
          stroke="${colors.value.bg}"
          stroke-width="1"
          paint-order="stroke fill"
        >
          ${$t('package.trends.legend_estimation')}
        </text>
      `)
  }

  return seriesNames.join('\n')
}

/**
 * Build and return npmx svg logo and tagline, to be injected during PNG & SVG exports
 */
function drawNpmxLogoAndTaglineWatermark(svg: Record<string, any>) {
  if (!svg?.drawingArea) return ''
  const npmxLogoWidthToHeight = 2.64
  const npmxLogoWidth = 100
  const npmxLogoHeight = npmxLogoWidth / npmxLogoWidthToHeight

  return `
    <svg x="${svg.drawingArea.left + svg.drawingArea.width / 2 - npmxLogoWidth / 2 - 3}" y="${svg.height - npmxLogoHeight}" width="${npmxLogoWidth}" height="${npmxLogoHeight}" viewBox="0 0 330 125" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.848 97V85.288H34.752V97H22.848ZM56.4105 107.56L85.5945 25H93.2745L64.0905 107.56H56.4105ZM121.269 97V46.12H128.661L128.949 59.08L127.989 58.216C128.629 55.208 129.781 52.744 131.445 50.824C133.173 48.84 135.221 47.368 137.589 46.408C139.957 45.448 142.453 44.968 145.077 44.968C148.981 44.968 152.213 45.832 154.773 47.56C157.397 49.288 159.381 51.624 160.725 54.568C162.069 57.448 162.741 60.68 162.741 64.264V97H154.677V66.568C154.677 61.832 153.749 58.248 151.893 55.816C150.037 53.32 147.189 52.072 143.349 52.072C140.725 52.072 138.357 52.648 136.245 53.8C134.133 54.888 132.437 56.52 131.157 58.696C129.941 60.808 129.333 63.432 129.333 66.568V97H121.269ZM173.647 111.4V46.12H181.135L181.327 57.64L180.175 57.064C181.455 53.096 183.568 50.088 186.512 48.04C189.519 45.992 192.976 44.968 196.88 44.968C201.936 44.968 206.064 46.216 209.264 48.712C212.528 51.208 214.928 54.472 216.464 58.504C218 62.536 218.767 66.888 218.767 71.56C218.767 76.232 218 80.584 216.464 84.616C214.928 88.648 212.528 91.912 209.264 94.408C206.064 96.904 201.936 98.152 196.88 98.152C194.256 98.152 191.792 97.704 189.487 96.808C187.247 95.912 185.327 94.664 183.727 93.064C182.191 91.464 181.135 89.576 180.559 87.4L181.711 86.056V111.4H173.647ZM196.111 90.472C200.528 90.472 203.984 88.808 206.48 85.48C209.04 82.152 210.319 77.512 210.319 71.56C210.319 65.608 209.04 60.968 206.48 57.64C203.984 54.312 200.528 52.648 196.111 52.648C193.167 52.648 190.607 53.352 188.431 54.76C186.319 56.168 184.655 58.28 183.439 61.096C182.287 63.912 181.711 67.4 181.711 71.56C181.711 75.72 182.287 79.208 183.439 82.024C184.591 84.84 186.255 86.952 188.431 88.36C190.607 89.768 193.167 90.472 196.111 90.472ZM222.57 97V46.12H229.962L230.25 57.448L229.29 57.256C229.866 53.48 231.082 50.504 232.938 48.328C234.858 46.088 237.29 44.968 240.234 44.968C243.242 44.968 245.546 46.056 247.146 48.232C248.81 50.408 249.834 53.608 250.218 57.832H249.258C249.834 53.864 251.114 50.728 253.098 48.424C255.146 46.12 257.706 44.968 260.778 44.968C264.874 44.968 267.85 46.376 269.706 49.192C271.562 52.008 272.49 56.68 272.49 63.208V97H264.426V64.36C264.426 59.816 263.946 56.648 262.986 54.856C262.026 53 260.522 52.072 258.474 52.072C257.13 52.072 255.946 52.52 254.922 53.416C253.898 54.248 253.066 55.592 252.426 57.448C251.85 59.304 251.562 61.672 251.562 64.552V97H243.498V64.36C243.498 60.008 243.018 56.872 242.058 54.952C241.162 53.032 239.658 52.072 237.546 52.072C236.202 52.072 235.018 52.52 233.994 53.416C232.97 54.248 232.138 55.592 231.498 57.448C230.922 59.304 230.634 61.672 230.634 64.552V97H222.57ZM276.676 97L295.396 70.888L277.636 46.12H287.044L300.388 65.32L313.444 46.12H323.044L305.38 71.08L323.908 97H314.5L300.388 76.456L286.276 97H276.676Z" fill="${colors.value.fg}"/>
    </svg>
    <text
      fill="${colors.value.fgMuted}"
      x="${svg.drawingArea.left + svg.drawingArea.width / 2}"
      y="${svg.height - npmxLogoHeight - 6}"
      font-size="12"
      text-anchor="middle"
    >
      ${$t('tagline')}
    </text>
  `
}

// VueUiXy chart component configuration
const chartConfig = computed(() => {
  return {
    theme: isDarkMode.value ? 'dark' : 'default',
    chart: {
      height: isMobile.value ? 950 : 600,
      backgroundColor: colors.value.bg,
      padding: { bottom: displayedGranularity.value === 'yearly' ? 84 : 64, right: 100 }, // padding right is set to leave space of last datapoint label(s)
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
            yLabel: $t('package.trends.y_axis_label', {
              granularity: getGranularityLabel(selectedGranularity.value),
              facet: activeMetricDef.value.label,
            }),
            yLabelOffsetX: 12,
            fontSize: isMobile.value ? 32 : 24,
          },
          xAxisLabels: {
            show: true,
            showOnlyAtModulo: true,
            modulo: 12,
            values: chartData.value?.dates,
            datetimeFormatter: {
              enable: true,
              locale: locale.value,
              useUTC: true,
              options: datetimeFormatterOptions.value,
            },
          },
          yAxis: {
            formatter: ({ value }: { value: number }) => {
              return compactNumberFormatter.value.format(Number.isFinite(value) ? value : 0)
            },
            useNiceScale: true, // daily/weekly -> true, monthly/yearly -> false
            gap: 24, // vertical gap between individual series in stacked mode
          },
        },
      },
      timeTag: {
        show: true,
        backgroundColor: colors.value.bgElevated,
        color: colors.value.fg,
        fontSize: 16,
        circleMarker: { radius: 3, color: colors.value.border },
        useDefaultFormat: true,
        timeFormat: 'yyyy-MM-dd HH:mm:ss',
      },
      highlighter: { useLine: true },
      legend: { show: false, position: 'top' },
      tooltip: {
        teleportTo: props.inModal ? '#chart-modal' : undefined,
        borderColor: 'transparent',
        backdropFilter: false,
        backgroundColor: 'transparent',
        customFormat: ({ datapoint }: { datapoint: Record<string, any> | any[] }) => {
          if (!datapoint) return ''

          const items = Array.isArray(datapoint) ? datapoint : [datapoint[0]]
          const hasMultipleItems = items.length > 1

          const rows = items
            .map((d: Record<string, any>) => {
              const label = String(d?.name ?? '').trim()
              const raw = Number(d?.value ?? 0)
              const v = compactNumberFormatter.value.format(Number.isFinite(raw) ? raw : 0)

              if (!hasMultipleItems) {
                // We don't need the name of the package in this case, since it is shown in the xAxis label
                return `<div>
                  <span class="text-base text-[var(--fg)] font-mono tabular-nums">${v}</span>
                </div>`
              }

              return `<div class="grid grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-x-3">
                <div class="w-3 h-3">
                  <svg viewBox="0 0 2 2" class="w-full h-full">
                    <rect x="0" y="0" width="2" height="2" rx="0.3" fill="${d.color}" />
                  </svg>
                </div>

                <span class="text-3xs uppercase tracking-wide text-[var(--fg)]/70 truncate">
                  ${label}
                </span>

                <span class="text-base text-[var(--fg)] font-mono tabular-nums text-end">
                  ${v}
                </span>
              </div>`
            })
            .join('')

          return `<div class="font-mono text-xs p-3 border border-border rounded-md bg-[var(--bg)]/10 backdrop-blur-md">
            <div class="${hasMultipleItems ? 'flex flex-col gap-2' : ''}">
              ${rows}
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
  }
})

// Trigger data loading when the metric is switched
watch(selectedMetric, value => {
  if (!isMounted.value) return
  loadMetric(value)
})
</script>

<template>
  <div
    class="w-full relative"
    id="trends-chart"
    :aria-busy="activeMetricState.pending ? 'true' : 'false'"
  >
    <div class="w-full mb-4 flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
        <SelectField
          v-if="showFacetSelector"
          id="trends-metric-select"
          v-model="selectedMetric"
          :items="METRICS.map(m => ({ label: m.label, value: m.id }))"
          :label="$t('package.trends.facet')"
        />

        <SelectField
          :label="$t('package.trends.granularity')"
          id="granularity"
          v-model="selectedGranularity"
          :disabled="activeMetricState.pending"
          :items="[
            { label: $t('package.trends.granularity_daily'), value: 'daily' },
            { label: $t('package.trends.granularity_weekly'), value: 'weekly' },
            { label: $t('package.trends.granularity_monthly'), value: 'monthly' },
            { label: $t('package.trends.granularity_yearly'), value: 'yearly' },
          ]"
        />

        <div class="grid grid-cols-2 gap-2 flex-1">
          <div class="flex flex-col gap-1">
            <label
              for="startDate"
              class="text-2xs font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.trends.start_date') }}
            </label>
            <div class="relative flex items-center">
              <span
                class="absolute inset-is-2 i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0 pointer-events-none"
                aria-hidden="true"
              />
              <InputBase
                id="startDate"
                v-model="startDate"
                :disabled="activeMetricState.pending"
                type="date"
                class="w-full min-w-0 bg-transparent ps-7"
                size="medium"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label for="endDate" class="text-2xs font-mono text-fg-subtle tracking-wide uppercase">
              {{ $t('package.trends.end_date') }}
            </label>
            <div class="relative flex items-center">
              <span
                class="absolute inset-is-2 i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0 pointer-events-none"
                aria-hidden="true"
              />
              <InputBase
                id="endDate"
                v-model="endDate"
                :disabled="activeMetricState.pending"
                type="date"
                class="w-full min-w-0 bg-transparent ps-7"
                size="medium"
              />
            </div>
          </div>
        </div>

        <button
          v-if="showResetButton"
          type="button"
          aria-label="Reset date range"
          class="self-end flex items-center justify-center px-2.5 py-1.75 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-accent/70 sm:mb-0"
          @click="resetDateRange"
        >
          <span class="i-carbon:reset w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>

    <h2 id="trends-chart-title" class="sr-only">
      {{ $t('package.trends.title') }} — {{ activeMetricDef.label }}
    </h2>

    <!-- Chart panel (active metric) -->
    <div role="region" aria-labelledby="trends-chart-title" class="min-h-[260px]">
      <ClientOnly v-if="chartData.dataset">
        <div :data-pending="pending" :data-minimap-visible="maxDatapoints > 6">
          <VueUiXy
            :dataset="normalisedDataset"
            :config="chartConfig"
            class="[direction:ltr]"
            @zoomStart="setIsZoom"
            @zoomEnd="setIsZoom"
            @zoomReset="isZoomed = false"
          >
            <!-- Injecting custom svg elements -->
            <template #svg="{ svg }">
              <!-- Estimation lines for monthly & yearly granularities when the end date induces a downwards trend -->
              <g
                v-if="
                  !pending &&
                  ['monthly', 'yearly'].includes(displayedGranularity) &&
                  !isEndDateOnPeriodEnd &&
                  !isZoomed
                "
                v-html="drawEstimationLine(svg)"
              />

              <!-- Last value label for all other cases -->
              <g v-if="!pending" v-html="drawLastDatapointLabel(svg)" />

              <!-- Inject legend during SVG print only -->
              <g v-if="svg.isPrintingSvg" v-html="drawSvgPrintLegend(svg)" />

              <!-- Inject npmx logo & tagline during SVG and PNG print -->
              <g
                v-if="svg.isPrintingSvg || svg.isPrintingImg"
                v-html="drawNpmxLogoAndTaglineWatermark(svg)"
              />

              <!-- Overlay covering the chart area to hide line resizing when switching granularities recalculates VueUiXy scaleMax when estimation lines are necessary -->
              <rect
                v-if="pending"
                :x="svg.drawingArea.left"
                :y="svg.drawingArea.top - 12"
                :width="svg.drawingArea.width + 12"
                :height="svg.drawingArea.height + 48"
                :fill="colors.bg"
              />
            </template>

            <!-- Subtle gradient applied for a unique series (chart modal) -->
            <template #area-gradient="{ series: chartModalSeries, id: gradientId }">
              <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" :stop-color="chartModalSeries.color" stop-opacity="0.2" />
                <stop offset="100%" :stop-color="colors.bg" stop-opacity="0" />
              </linearGradient>
            </template>

            <!-- Custom legend for multiple series -->
            <template #legend="{ legend }">
              <div class="flex gap-4 flex-wrap justify-center">
                <template v-if="isMultiPackageMode">
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
                        <rect x="0" y="0" width="2" height="2" rx="0.3" :fill="datapoint.color" />
                      </svg>
                    </div>
                    <span
                      :style="{
                        textDecoration: datapoint.isSegregated ? 'line-through' : undefined,
                      }"
                    >
                      {{ datapoint.name }}
                    </span>
                  </button>
                </template>

                <!-- Single series legend (no user interaction) -->
                <template v-else-if="legend.length > 0">
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

                <!-- Estimation extra legend item -->
                <div
                  class="flex gap-1 place-items-center"
                  v-if="['monthly', 'yearly'].includes(selectedGranularity)"
                >
                  <svg viewBox="0 0 20 2" width="20">
                    <line
                      x1="0"
                      y1="1"
                      x2="20"
                      y2="1"
                      :stroke="colors.fg"
                      stroke-dasharray="4"
                      stroke-linecap="round"
                    />
                  </svg>
                  <span class="text-fg-subtle">{{ $t('package.trends.legend_estimation') }}</span>
                </div>
              </div>
            </template>

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
        </div>

        <template #fallback>
          <div class="min-h-[260px]" />
        </template>
      </ClientOnly>

      <div
        v-if="!chartData.dataset && !activeMetricState.pending"
        class="min-h-[260px] flex items-center justify-center text-fg-subtle font-mono text-sm"
      >
        {{ $t('package.trends.no_data') }}
      </div>
    </div>

    <div
      v-if="activeMetricState.pending"
      role="status"
      aria-live="polite"
      class="absolute top-1/2 inset-is-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-fg-subtle font-mono bg-bg/70 backdrop-blur px-3 py-2 rounded-md border border-border"
    >
      {{ $t('package.trends.loading') }}
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

/* Override default placement of the refresh button to have it to the minimap's side */
@media screen and (min-width: 767px) {
  #trends-chart .vue-data-ui-refresh-button {
    top: -0.6rem !important;
    left: calc(100% + 2rem) !important;
  }
}

[data-pending='true'] .vue-data-ui-zoom {
  opacity: 0.1;
}

[data-pending='true'] .vue-data-ui-time-label {
  opacity: 0;
}

/** Override print watermark position to have it below the chart */
.vue-data-ui-watermark {
  top: unset !important;
}

[data-minimap-visible='false'] .vue-data-ui-watermark {
  top: calc(100% - 2rem) !important;
}
</style>
