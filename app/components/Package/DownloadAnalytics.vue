<script setup lang="ts">
import type { VueUiXyDatasetItem } from 'vue-data-ui'
import { VueUiXy } from 'vue-data-ui/vue-ui-xy'
import { useDebounceFn, useElementSize } from '@vueuse/core'
import { useCssVariables } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch } from '~/utils/colors'
import { getFrameworkColor, isListedFramework } from '~/utils/frameworks'

const props = defineProps<{
  // For single package downloads history
  weeklyDownloads?: WeeklyDownloadPoint[]
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

  loadNow()
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

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

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
          series: dataset.map(d => d.downloads),
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
          series: dataset.map(d => d.downloads),
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
          series: dataset.map(d => d.downloads),
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
          series: dataset.map(d => d.downloads),
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
 * - `downloads`: the corresponding value at that time
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
 * @returns An array of normalized `{ timestamp, downloads }` points
 */
function extractSeriesPoints(
  selectedGranularity: ChartTimeGranularity,
  dataset: EvolutionData,
): Array<{ timestamp: number; downloads: number }> {
  if (selectedGranularity === 'weekly' && isWeeklyDataset(dataset)) {
    return dataset.map(d => ({ timestamp: d.timestampEnd, downloads: d.downloads }))
  }
  if (selectedGranularity === 'daily' && isDailyDataset(dataset)) {
    return dataset.map(d => ({ timestamp: d.timestamp, downloads: d.downloads }))
  }
  if (selectedGranularity === 'monthly' && isMonthlyDataset(dataset)) {
    return dataset.map(d => ({ timestamp: d.timestamp, downloads: d.downloads }))
  }
  if (selectedGranularity === 'yearly' && isYearlyDataset(dataset)) {
    return dataset.map(d => ({ timestamp: d.timestamp, downloads: d.downloads }))
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

const xAxisLabel = computed(() => {
  if (!isMultiPackageMode.value) return props.packageName ?? ''
  const names = effectivePackageNames.value
  if (names.length === 1) return names[0]
  return 'packages'
})

const selectedGranularity = shallowRef<ChartTimeGranularity>('weekly')
const displayedGranularity = shallowRef<ChartTimeGranularity>('weekly')

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
  | { granularity: 'month'; months: number; startDate?: string; endDate?: string }
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

const { fetchPackageDownloadEvolution } = useCharts()

const evolution = shallowRef<EvolutionData>(props.weeklyDownloads ?? [])
const evolutionsByPackage = shallowRef<Record<string, EvolutionData>>({})
const pending = shallowRef(false)

const isMounted = shallowRef(false)
let requestToken = 0

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
      pending.value = false
      return
    }

    const o = options.value as any
    const hasExplicitRange = Boolean(o.startDate || o.endDate)

    // Do not show loading when weeklyDownloads is already provided
    if (
      !isMultiPackageMode.value &&
      o.granularity === 'week' &&
      props.weeklyDownloads?.length &&
      !hasExplicitRange
    ) {
      pending.value = false
      return
    }

    pending.value = true
  },
  { immediate: true },
)

/**
 * Fetches download evolution data based on the current granularity,
 * date range, and package selection.
 *
 * This function:
 * - runs only on the client
 * - supports both single-package and multi-package modes
 * - applies request de-duplication via a request token to avoid race conditions
 * - updates the appropriate reactive stores with fetched data
 * - manages the `pending` loading state
 *
 * Behavior details:
 * - In multi-package mode, all packages are fetched in parallel and partial
 *   failures are tolerated using `Promise.allSettled`
 * - In single-package mode, weekly data is reused from `weeklyDownloads`
 *   when available and no explicit date range is requested
 * - Outdated responses are discarded when a newer request supersedes them
 *
 */
async function loadNow() {
  if (!import.meta.client) return

  const packageNames = effectivePackageNames.value
  if (!packageNames.length) return

  const currentToken = ++requestToken
  pending.value = true

  try {
    if (isMultiPackageMode.value) {
      const settled = await Promise.allSettled(
        packageNames.map(async pkg => {
          const result = await fetchPackageDownloadEvolution(
            pkg,
            props.createdIso ?? null,
            options.value,
          )
          return { pkg, result: (result ?? []) as EvolutionData }
        }),
      )

      if (currentToken !== requestToken) return

      const next: Record<string, EvolutionData> = {}
      for (const entry of settled) {
        if (entry.status === 'fulfilled') next[entry.value.pkg] = entry.value.result
      }

      evolutionsByPackage.value = next
      displayedGranularity.value = selectedGranularity.value
      return
    }

    const pkg = packageNames[0] ?? ''
    if (!pkg) {
      evolution.value = []
      displayedGranularity.value = selectedGranularity.value
      return
    }

    const o = options.value
    const hasExplicitRange = Boolean((o as any).startDate || (o as any).endDate)
    if (o.granularity === 'week' && props.weeklyDownloads?.length && !hasExplicitRange) {
      evolution.value = props.weeklyDownloads
      displayedGranularity.value = 'weekly'
      return
    }

    const result = await fetchPackageDownloadEvolution(pkg, props.createdIso ?? null, options.value)
    if (currentToken !== requestToken) return

    evolution.value = (result ?? []) as EvolutionData
    displayedGranularity.value = selectedGranularity.value
  } catch {
    if (currentToken !== requestToken) return
    if (isMultiPackageMode.value) evolutionsByPackage.value = {}
    else evolution.value = []
  } finally {
    if (currentToken === requestToken) pending.value = false
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
  loadNow()
}, 1000)

const fetchTriggerKey = computed(() => {
  const names = effectivePackageNames.value.join(',')
  const o = options.value as any
  return [
    isMultiPackageMode.value ? 'M' : 'S',
    names,
    String(props.createdIso ?? ''),
    String(o.granularity ?? ''),
    String(o.weeks ?? ''),
    String(o.months ?? ''),
    String(o.startDate ?? ''),
    String(o.endDate ?? ''),
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
  if (displayedGranularity.value === 'weekly' && props.weeklyDownloads?.length) {
    if (isWeeklyDataset(evolution.value) && evolution.value.length) return evolution.value
    return props.weeklyDownloads
  }
  return evolution.value
})

/**
 * Normalized chart data derived from the fetched evolution datasets.
 *
 * This computed value adapts its behavior based on the current mode:
 *
 * - **Single-package mode**
 *   - Delegates formatting to `formatXyDataset`
 *   - Produces a single series with its corresponding timestamps
 *
 * - **Multi-package mode**
 *   - Merges multiple package datasets into a shared time axis
 *   - Aligns all series on the same sorted list of timestamps
 *   - Fills missing datapoints with `0` to keep series lengths consistent
 *   - Assigns framework-specific colors when applicable
 *
 * The returned structure matches the expectations of `VueUiXy`:
 * - `dataset`: array of series definitions, or `null` when no data is available
 * - `dates`: sorted list of timestamps used as the x-axis reference
 *
 * Returning `dataset: null` explicitly signals the absence of data and allows
 * the template to handle empty states without ambiguity.
 */
const chartData = computed<{ dataset: VueUiXyDatasetItem[] | null; dates: number[] }>(() => {
  if (!isMultiPackageMode.value) {
    const pkg = effectivePackageNames.value[0] ?? props.packageName ?? ''
    return formatXyDataset(displayedGranularity.value, effectiveDataSingle.value, pkg)
  }

  const names = effectivePackageNames.value
  const granularity = displayedGranularity.value

  const timestampSet = new Set<number>()
  const pointsByPackage = new Map<string, Array<{ timestamp: number; downloads: number }>>()

  for (const pkg of names) {
    const data = evolutionsByPackage.value[pkg] ?? []
    const points = extractSeriesPoints(granularity, data)
    pointsByPackage.set(pkg, points)
    for (const p of points) timestampSet.add(p.timestamp)
  }

  const dates = Array.from(timestampSet).sort((a, b) => a - b)
  if (!dates.length) return { dataset: null, dates: [] }

  const dataset: VueUiXyDatasetItem[] = names.map(pkg => {
    const points = pointsByPackage.get(pkg) ?? []
    const map = new Map<number, number>()
    for (const p of points) map.set(p.timestamp, p.downloads)

    const series = dates.map(t => map.get(t) ?? 0)

    const item: VueUiXyDatasetItem = { name: pkg, type: 'line', series } as VueUiXyDatasetItem

    if (isListedFramework(pkg)) {
      item.color = getFrameworkColor(pkg)
    }
    // Other packages default to built-in palette
    return item
  })

  return { dataset, dates }
})

/**
 * Maximum estimated value across all series when the chart is
 * displaying a partially completed time bucket (monthly or yearly).
 *
 * Used to determine whether the Y-axis upper bound must be extended to accommodate extrapolated values.
 * It does not mutate chart state or rendering directly.
 *
 * Behavior:
 * - Returns `0` when:
 *   - the chart is loading (`pending === true`)
 *   - the current granularity is not `monthly` or `yearly`
 *   - the dataset is empty or has fewer than two points
 *   - the last bucket is fully completed
 *
 * - For partially completed buckets:
 *   - Computes the bucket completion ratio using UTC boundaries
 *   - Linearly extrapolates the last datapoint of each series
 *   - Returns the maximum extrapolated value across all series
 *
 * The reference time used for completion is:
 * - the end of `endDate` (UTC) when provided, or
 * - the current time (`Date.now()`) otherwise
 *
 * @returns The maximum extrapolated value across all series, or `0` when
 * estimation is not applicable.
 */
const estimatedMaxFromData = computed<number>(() => {
  if (pending.value) return 0
  if (!isEstimationGranularity.value) return 0

  const dataset = chartData.value.dataset
  const dates = chartData.value.dates
  if (!dataset?.length || dates.length < 2) return 0

  const lastBucketTimestampMs = dates[dates.length - 1] ?? 0
  const endDateMs = endDate.value ? endDateOnlyToUtcMs(endDate.value) : null
  const referenceMs = endDateMs ?? Date.now()

  const completionRatio = getCompletionRatioForBucket({
    bucketTimestampMs: lastBucketTimestampMs,
    granularity: displayedGranularity.value as 'monthly' | 'yearly',
    referenceMs,
  })

  if (!(completionRatio > 0 && completionRatio < 1)) return 0

  let maxEstimated = 0

  for (const serie of dataset) {
    const values = Array.isArray((serie as any).series) ? ((serie as any).series as number[]) : []
    if (values.length < 2) continue

    const lastValue = Number(values[values.length - 1])
    if (!Number.isFinite(lastValue) || lastValue <= 0) continue

    const estimated = lastValue / completionRatio
    if (Number.isFinite(estimated) && estimated > maxEstimated) maxEstimated = estimated
  }

  return maxEstimated
})

const yAxisScaleMax = computed<number | undefined>(() => {
  if (!isEstimationGranularity.value || pending.value) return undefined

  const datasetMax = getDatasetMaxValue(chartData.value.dataset)
  const estimatedMax = estimatedMaxFromData.value
  const candidateMax = Math.max(datasetMax, estimatedMax)

  const niceMax = candidateMax > 0 ? niceMaxScale(candidateMax) : 0
  return niceMax > datasetMax ? niceMax : undefined
})

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
 * Returns a "nice" rounded upper bound for a positive value, suitable for
 * chart axis scaling.
 *
 * The value is converted to a power-of-ten range and then rounded up to the
 * next monotonic step within that decade (1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10).
 *
 * VueUiXy computes its own nice scale from the dataset.
 * However, when injecting an estimation for partial datapoints, the scale must be forced to avoid
 * overflowing the estimation if it were to become the max value. This scale is fed into the `scaleMax`
 * config attribute of VueUiXy.
 *
 * Examples:
 * - `niceMaxScale(2_340)` returns `2_500`
 * - `niceMaxScale(7_100)` returns `8_000`
 * - `niceMaxScale(12)` returns `12.5`
 *
 * @param value - Candidate maximum value
 * @returns A nice maximum >= `value`, or `0` when `value` is not finite or <= 0.
 */
function niceMaxScale(value: number): number {
  const v = Number(value)
  if (!Number.isFinite(v) || v <= 0) return 0

  const exponent = Math.floor(Math.log10(v))
  const base = 10 ** exponent
  const fraction = v / base

  // Monotonic scale steps
  if (fraction <= 1) return 1 * base
  if (fraction <= 1.25) return 1.25 * base
  if (fraction <= 1.5) return 1.5 * base
  if (fraction <= 2) return 2 * base
  if (fraction <= 2.5) return 2.5 * base
  if (fraction <= 3) return 3 * base
  if (fraction <= 4) return 4 * base
  if (fraction <= 5) return 5 * base
  if (fraction <= 6) return 6 * base
  if (fraction <= 8) return 8 * base
  return 10 * base
}

/**
 * Extrapolates the last datapoint of a series when it belongs to a partially
 * completed time bucket (monthly or yearly).
 *
 * The extrapolation assumes that the observed value of the last datapoint
 * grows linearly with time within its bucket. The value is scaled by the
 * inverse of the bucket completion ratio, and the corresponding y
 * coordinate is computed by projecting along the segment defined by the
 * previous and last datapoints.
 *
 * Extrapolation is performed only when:
 * - the granularity is `monthly` or `yearly`
 * - the bucket completion ratio is strictly between `0` and `1`
 *
 * In all other cases, the original `lastPoint` is returned unchanged.
 *
 * The reference time used to compute the completion ratio is:
 * - the end of `endDateOnly` (UTC) when provided, or
 * - the current time (`Date.now()`) otherwise
 *
 * @param params.previousPoint - Datapoint immediately preceding the last one
 * @param params.lastPoint - Last observed datapoint (potentially incomplete)
 * @param params.lastBucketTimestampMs - Timestamp identifying the bucket of the last datapoint
 * @param params.granularity - Chart granularity
 * @param params.endDateOnly - Optional `YYYY-MM-DD` end date used as a fixed reference time
 * @returns A new datapoint representing the extrapolated estimate, or the
 *          original `lastPoint` when extrapolation is not applicable.
 */
function extrapolateIncompleteLastPoint(params: {
  previousPoint: { x: number; y: number; value: number }
  lastPoint: { x: number; y: number; value: number; comment?: string }
  lastBucketTimestampMs: number
  granularity: ChartTimeGranularity
  endDateOnly?: string
}) {
  if (params.granularity !== 'monthly' && params.granularity !== 'yearly')
    return { ...params.lastPoint }

  const endDateMs = params.endDateOnly ? endDateOnlyToUtcMs(params.endDateOnly) : null
  const referenceMs = endDateMs ?? Date.now()

  const completionRatio = getCompletionRatioForBucket({
    bucketTimestampMs: params.lastBucketTimestampMs,
    granularity: params.granularity,
    referenceMs,
  })

  if (!(completionRatio > 0 && completionRatio < 1)) return { ...params.lastPoint }

  const extrapolatedValue = params.lastPoint.value / completionRatio
  if (!Number.isFinite(extrapolatedValue)) return { ...params.lastPoint }

  const valueDelta = params.lastPoint.value - params.previousPoint.value
  const yDelta = params.lastPoint.y - params.previousPoint.y

  if (valueDelta === 0)
    return { ...params.lastPoint, value: extrapolatedValue, comment: 'extrapolated' }

  const valueToYPixelRatio = yDelta / valueDelta
  const extrapolatedY =
    params.previousPoint.y + (extrapolatedValue - params.previousPoint.value) * valueToYPixelRatio

  return {
    x: params.lastPoint.x,
    y: extrapolatedY,
    value: extrapolatedValue,
    comment: 'extrapolated',
  }
}

/**
 * Compute the max value across all series in a `VueUiXy` dataset.
 *
 * @param dataset - Array of `VueUiXyDatasetItem` objects, or `null`
 * @returns The maximum finite value found across all series, or `0` when
 * the dataset is empty or absent.
 */
function getDatasetMaxValue(dataset: VueUiXyDatasetItem[] | null): number {
  if (!dataset?.length) return 0
  let max = 0
  for (const serie of dataset) {
    const values = Array.isArray((serie as any).series) ? ((serie as any).series as number[]) : []
    for (const v of values) {
      const n = Number(v)
      if (Number.isFinite(n) && n > max) max = n
    }
  }
  return max
}

/**
 * Build and return svg markup for estimation overlays on the chart.
 *
 * This function is used in the `#svg` slot of `VueUiXy` to visually indicate
 * estimated values for partially completed monthly or yearly periods.
 *
 * For each series:
 * - extrapolates the last datapoint when it belongs to an incomplete time bucket
 * - draws a dashed line from the previous datapoint to the extrapolated position
 * - masks the original line segment to avoid visual overlap
 * - renders marker circles at relevant points
 * - displays a formatted label for the estimated value
 *
 * While computing estimations, the function also evaluates whether the Y-axis
 * scale needs to be extended to accommodate estimated values. When required,
 * it commits a deferred `scaleMax` update using `commitYAxisScaleMaxLater`.
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

  // Use the last bucket timestamp once (shared x-axis dates)
  const lastBucketTimestampMs = chartData.value?.dates?.at(-1) ?? 0

  for (const serie of data) {
    const plots = serie?.plots
    if (!Array.isArray(plots) || plots.length < 2) continue

    const previousPoint = plots.at(-2)
    const lastPoint = plots.at(-1)
    if (!previousPoint || !lastPoint) continue

    const estimationPoint = extrapolateIncompleteLastPoint({
      previousPoint,
      lastPoint,
      lastBucketTimestampMs,
      granularity: displayedGranularity.value,
      endDateOnly: endDate.value,
    })

    const stroke = String(serie?.color ?? colors.value.fg)

    /**
     * The following svg elements are injected in the #svg slot of VueUiXy:
     * - a dashed line connecting the last datapoint to its ancestor
     * - a line overlay covering the path segment of 'real data' between last datapoint and its ancestor
     * - circles on the estimation coordinates, and another on the ancestor to mitigate the line overlay
     * - the formatted data label
     */

    lines.push(`
      <line 
        x1="${previousPoint.x}" 
        y1="${previousPoint.y}" 
        x2="${lastPoint.x}" 
        y2="${estimationPoint.y}" 
        stroke="${stroke}" 
        stroke-width="3"
        stroke-dasharray="4 8"
        stroke-linecap="round"
      />
      <line
        x1="${previousPoint.x}" 
        y1="${previousPoint.y}" 
        x2="${lastPoint.x}" 
        y2="${lastPoint.y}" 
        stroke="${colors.value.bg}" 
        stroke-width="3"
        opacity="0.7"
      />
      <circle
        cx="${lastPoint.x}"
        cy="${lastPoint.y}"
        r="4"
        fill="${colors.value.bg}"
        opacity="0.7"
      />
      <circle
        cx="${lastPoint.x}"
        cy="${estimationPoint.y}"
        r="4"
        fill="${stroke}"
        stroke="${colors.value.bg}"
        stroke-width="2"
      />
      <circle
        cx="${previousPoint.x}"
        cy="${previousPoint.y}"
        r="4"
        fill="${stroke}"
        stroke="${colors.value.bg}"
        stroke-width="2"
      />
      <text
        text-anchor="start"
        dominant-baseline="middle"
        x="${lastPoint.x + 12}"
        y="${estimationPoint.y}"
        font-size="24"
        fill="${colors.value.fg}"
        stroke="${colors.value.bg}"
        stroke-width="1"
        paint-order="stroke fill"
      >
        ${compactNumberFormatter.value.format(Number.isFinite(estimationPoint.value) ? estimationPoint.value : 0)}
      </text>
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

// VueUiXy chart component configuration
const chartConfig = computed(() => {
  return {
    theme: isDarkMode.value ? 'dark' : 'default',
    chart: {
      height: isMobile.value ? 950 : 600,
      backgroundColor: colors.value.bg,
      padding: { bottom: 36, right: 100 }, // padding right is set to leave space of last datapoint label(s)
      userOptions: {
        buttons: { pdf: false, labels: false, fullscreen: false, table: false, tooltip: false },
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
        labels: {
          fontSize: isMobile.value ? 24 : 16,
          color: pending.value ? colors.value.border : colors.value.fgSubtle,
          axis: {
            yLabel: $t('package.trends.y_axis_label', {
              granularity: getGranularityLabel(selectedGranularity.value),
              facet: $t('package.trends.items.downloads'),
            }),
            xLabel: isMultiPackageMode.value ? '' : xAxisLabel.value, // for multiple series, names are displayed in the chart's legend
            yLabelOffsetX: 12,
            fontSize: isMobile.value ? 32 : 24,
          },
          xAxisLabels: {
            show: false,
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
            useNiceScale: !isEstimationGranularity.value || pending.value, // daily/weekly -> true, monthly/yearly -> false
            scaleMax: yAxisScaleMax.value,
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
</script>

<template>
  <div class="w-full relative" id="download-analytics" :aria-busy="pending ? 'true' : 'false'">
    <div class="w-full mb-4 flex flex-col gap-3">
      <div class="flex flex-col sm:flex-row gap-3 sm:gap-2 sm:items-end">
        <div class="flex flex-col gap-1 sm:shrink-0">
          <label
            for="granularity"
            class="text-3xs font-mono text-fg-subtle tracking-wide uppercase"
          >
            {{ $t('package.trends.granularity') }}
          </label>

          <div
            class="flex items-center bg-bg-subtle border border-border rounded-md overflow-hidden"
          >
            <select
              id="granularity"
              v-model="selectedGranularity"
              :disabled="pending"
              class="w-full px-2.5 py-1.75 bg-bg-subtle font-mono text-sm text-fg outline-none appearance-none focus-visible:outline-accent/70"
            >
              <option value="daily">
                {{ $t('package.trends.granularity_daily') }}
              </option>
              <option value="weekly">
                {{ $t('package.trends.granularity_weekly') }}
              </option>
              <option value="monthly">
                {{ $t('package.trends.granularity_monthly') }}
              </option>
              <option value="yearly">
                {{ $t('package.trends.granularity_yearly') }}
              </option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 flex-1">
          <div class="flex flex-col gap-1">
            <label
              for="startDate"
              class="text-3xs font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.trends.start_date') }}
            </label>
            <div
              class="flex items-center gap-2 px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-accent/70)"
            >
              <span class="i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0" aria-hidden="true" />
              <input
                id="startDate"
                v-model="startDate"
                :disabled="pending"
                type="date"
                class="w-full min-w-0 bg-transparent font-mono text-sm text-fg outline-none [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label for="endDate" class="text-3xs font-mono text-fg-subtle tracking-wide uppercase">
              {{ $t('package.trends.end_date') }}
            </label>
            <div
              class="flex items-center gap-2 px-2.5 py-1.75 bg-bg-subtle border border-border rounded-md focus-within:(border-border-hover ring-2 ring-accent/70)"
            >
              <span class="i-carbon:calendar w-4 h-4 text-fg-subtle shrink-0" aria-hidden="true" />
              <input
                id="endDate"
                v-model="endDate"
                :disabled="pending"
                type="date"
                class="w-full min-w-0 bg-transparent font-mono text-sm text-fg outline-none [color-scheme:light] dark:[color-scheme:dark]"
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

    <h2 id="download-analytics-title" class="sr-only">
      {{ $t('package.downloads.title') }}
    </h2>

    <div role="region" aria-labelledby="download-analytics-title">
      <ClientOnly v-if="chartData.dataset">
        <div :data-pending="pending">
          <VueUiXy
            :dataset="chartData.dataset"
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
              <g
                v-if="
                  !pending &&
                  (['daily', 'weekly'].includes(displayedGranularity) ||
                    isEndDateOnPeriodEnd ||
                    isZoomed)
                "
                v-html="drawLastDatapointLabel(svg)"
              />

              <!-- Overlay covering the chart area to hide line resizing when switching granularities recalculates VueUiXy scaleMax when estimation lines are necessary -->
              <rect
                v-if="pending"
                :x="svg.drawingArea.left"
                :y="svg.drawingArea.top - 12"
                :width="svg.drawingArea.width + 12"
                :height="svg.drawingArea.height + 24"
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
            <template
              v-if="isMultiPackageMode || ['monthly', 'yearly'].includes(displayedGranularity)"
              #legend="{ legend }"
            >
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
    </div>

    <div
      v-if="!chartData.dataset && !pending"
      class="min-h-[260px] flex items-center justify-center text-fg-subtle font-mono text-sm"
    >
      {{
        $t('package.trends.no_data', {
          facet: $t('package.trends.items.downloads'),
        })
      }}
    </div>

    <div
      v-if="pending"
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
  #download-analytics .vue-data-ui-refresh-button {
    top: -0.6rem !important;
    left: calc(100% + 2rem) !important;
  }
}

[data-pending='true'] .vue-data-ui-zoom {
  opacity: 0.1;
}
</style>
