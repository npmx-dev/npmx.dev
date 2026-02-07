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

const { width } = useElementSize(rootEl)

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

const formatter = ({ value }: { value: number }) => formatCompactNumber(value, { decimals: 1 })

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
  daily: $t('package.downloads.granularity_daily'),
  weekly: $t('package.downloads.granularity_weekly'),
  monthly: $t('package.downloads.granularity_monthly'),
  yearly: $t('package.downloads.granularity_yearly'),
}))

function getGranularityLabel(granularity: ChartTimeGranularity) {
  return granularityLabels.value[granularity]
}

// VueUiXy chart component configuration
const chartConfig = computed(() => {
  return {
    theme: isDarkMode.value ? 'dark' : 'default',
    chart: {
      height: isMobile.value ? 950 : 600,
      padding: { bottom: 36 },
      userOptions: {
        buttons: { pdf: false, labels: false, fullscreen: false, table: false, tooltip: false },
        buttonTitles: {
          csv: $t('package.downloads.download_file', { fileType: 'CSV' }),
          img: $t('package.downloads.download_file', { fileType: 'PNG' }),
          svg: $t('package.downloads.download_file', { fileType: 'SVG' }),
          annotator: $t('package.downloads.toggle_annotator'),
        },
        callbacks: {
          img: ({ imageUri }: { imageUri: string }) => {
            loadFile(imageUri, buildExportFilename('png'))
          },
          csv: (csvStr: string) => {
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
      backgroundColor: colors.value.bg,
      grid: {
        stroke: colors.value.border,
        labels: {
          fontSize: isMobile.value ? 24 : 16,
          axis: {
            yLabel: $t('package.downloads.y_axis_label', {
              granularity: getGranularityLabel(selectedGranularity.value),
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
            formatter,
            useNiceScale: true,
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
            .map((d: any) => {
              const label = String(d?.name ?? '').trim()
              const raw = Number(d?.value ?? 0)
              const v = formatter({ value: Number.isFinite(raw) ? raw : 0 })

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

                <span class="text-[10px] uppercase tracking-wide text-[var(--fg)]/70 truncate">
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
            class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
          >
            {{ $t('package.downloads.granularity') }}
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
              <option value="daily">{{ $t('package.downloads.granularity_daily') }}</option>
              <option value="weekly">{{ $t('package.downloads.granularity_weekly') }}</option>
              <option value="monthly">{{ $t('package.downloads.granularity_monthly') }}</option>
              <option value="yearly">{{ $t('package.downloads.granularity_yearly') }}</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 flex-1">
          <div class="flex flex-col gap-1">
            <label
              for="startDate"
              class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.downloads.start_date') }}
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
            <label
              for="endDate"
              class="text-[10px] font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.downloads.end_date') }}
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
        <div>
          <VueUiXy :dataset="chartData.dataset" :config="chartConfig" class="[direction:ltr]">
            <!-- Subtle gradient applied for a unique series (chart modal) -->
            <template #area-gradient="{ series: chartModalSeries, id: gradientId }">
              <linearGradient :id="gradientId" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" :stop-color="chartModalSeries.color" stop-opacity="0.2" />
                <stop offset="100%" :stop-color="colors.bg" stop-opacity="0" />
              </linearGradient>
            </template>

            <!-- Custom legend for multiple series -->
            <template v-if="isMultiPackageMode" #legend="{ legend }">
              <div class="flex gap-4 flex-wrap justify-center">
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

/* Override default placement of the refresh button to have it to the minimap's side */
@media screen and (min-width: 767px) {
  #download-analytics .vue-data-ui-refresh-button {
    top: -0.6rem !important;
    left: calc(100% + 2rem) !important;
  }
}
</style>
