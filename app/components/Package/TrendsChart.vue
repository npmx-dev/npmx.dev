<script setup lang="ts">
import { VueUiXy, type VueUiXyConfig, type VueUiXySvgSlotProps } from 'vue-data-ui/vue-ui-xy'
import { useTooltipPosition } from 'vue-data-ui/composables'
import { useDebounceFn, useElementSize, useTimeoutFn } from '@vueuse/core'
import { useColors } from '~/composables/useColors'
import { OKLCH_NEUTRAL_FALLBACK, transparentizeOklch } from '~/utils/colors'
import { drawNpmxLogoAndTaglineWatermark } from '~/composables/useChartWatermark'
import type { RepoRef } from '#shared/utils/git-providers'
import type {
  ChartTimeGranularity,
  DateRangeFields,
  EvolutionData,
  EvolutionOptions,
  WeeklyDataPoint,
} from '~/types/chart'
import { DATE_INPUT_MAX } from '~/utils/input'
import { endDateOnlyToUtcMs } from '~/utils/chart-data-prediction'
import { applyBlocklistCorrection, getAnomaliesForPackages } from '~/utils/download-anomalies'
import { copyAltTextForTrendLineChart, sanitise, applyEllipsis } from '~/utils/charts'
import {
  buildNormalisedTrendsDataset,
  buildTrendsChartConfig,
  buildTrendsChartData,
  isWeeklyDataset,
  getTrendsDatetimeFormatterOptions,
} from '#shared/utils/trends-chart'
import { downloadFileLink } from '~/utils/download'
import { createLastDatapointLabelsSvg } from '#shared/utils/download-chart-last-label'

import('vue-data-ui/style.css')

const props = withDefaults(
  defineProps<{
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
    repoRef?: RepoRef | null | undefined
    createdIso?: string | null

    /** When true, shows facet selector (e.g. Downloads / Likes). */
    showFacetSelector?: boolean
    permalink?: boolean
    defaultRange?: 'auto' | '52-weeks'
  }>(),
  {
    defaultRange: 'auto',
    permalink: false,
  },
)

const { locale } = useI18n()
const { accentColors, selectedAccentColor } = useAccentColor()
const { settings } = useSettings()
const { copy, copied } = useClipboard()

const colorMode = useColorMode()
const resolvedMode = shallowRef<'light' | 'dark'>('light')
const rootEl = shallowRef<HTMLElement | null>(null)
const isZoomed = shallowRef(false)

const chartRef = useTemplateRef('chartRef')

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

const { colors } = useColors(rootEl)

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

const watermarkColors = computed(() => ({
  fg: colors.value.fg ?? OKLCH_NEUTRAL_FALLBACK,
  bg: colors.value.bg ?? OKLCH_NEUTRAL_FALLBACK,
  fgSubtle: colors.value.fgSubtle ?? OKLCH_NEUTRAL_FALLBACK,
}))

const mobileBreakpointWidth = 640
const isMobile = computed(() => width.value > 0 && width.value < mobileBreakpointWidth)

const DEFAULT_GRANULARITY: ChartTimeGranularity = 'weekly'

const chartData = computed(() =>
  buildTrendsChartData({
    packageNames: effectivePackageNames.value,
    effectivePackageNamesForMetric: effectivePackageNamesForMetric.value,
    isMultiPackageMode: isMultiPackageMode.value,
    selectedMetric: selectedMetric.value,
    selectedMetricLabel: activeMetricDef.value?.label ?? '',
    selectedGranularity: selectedGranularity.value,
    displayedGranularity: displayedGranularity.value,
    singleEvolution: effectiveDataSingle.value,
    evolutionsByPackage: activeMetricState.value.evolutionsByPackage,
    colors: colors.value,
    accent: accent.value,
    isDarkMode: isDarkMode.value,
    useAnomalyCorrection: settings.value.chartFilter.anomaliesFixed,
    applyAnomalyCorrection: applyBlocklistCorrection,
    chartFilter: settings.value.chartFilter,
    t: $t,
    compactNumberFormatter: compactNumberFormatter.value,
  }),
)

const normalisedDataset = computed(() =>
  buildNormalisedTrendsDataset({
    dataset: chartData.value.dataset,
    dates: chartData.value.dates,
    granularity: displayedGranularity.value,
    selectedMetric: selectedMetric.value,
    chartFilter: settings.value.chartFilter,
    endDateMs: endDate.value ? endDateOnlyToUtcMs(endDate.value) : null,
  }),
)

const datetimeFormatterOptions = computed(() =>
  getTrendsDatetimeFormatterOptions(selectedGranularity.value),
)

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

const {
  fetchPackageDownloadEvolution,
  fetchPackageLikesEvolution,
  fetchRepoContributorsEvolution,
  fetchRepoRefsForPackages,
} = useCharts()

const repoRefsByPackage = shallowRef<Record<string, RepoRef | null>>({})
const repoRefsRequestToken = shallowRef(0)
const repoRefsPending = shallowRef(false)

watch(
  () => effectivePackageNames.value,
  async names => {
    if (!import.meta.client) return
    const currentToken = ++repoRefsRequestToken.value
    repoRefsPending.value = true
    try {
      const refs = await fetchRepoRefsForPackages(names)
      if (currentToken !== repoRefsRequestToken.value) return
      repoRefsByPackage.value = refs
    } finally {
      if (currentToken === repoRefsRequestToken.value) repoRefsPending.value = false
    }
  },
  { immediate: true },
)

const selectedGranularity = usePermalink<ChartTimeGranularity>('granularity', DEFAULT_GRANULARITY, {
  permanent: props.permalink,
})

const displayedGranularity = shallowRef<ChartTimeGranularity>(DEFAULT_GRANULARITY)

const isEndDateOnPeriodEnd = computed(() => {
  const g = selectedGranularity.value

  const iso = String(endDate.value ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false

  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return false

  if (g === 'daily') return true // every day is a complete period

  if (g === 'weekly') {
    // The last week bucket is complete when the range length is divisible by 7
    const startIso = String(startDate.value ?? '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startIso)) return false
    const startMs = Date.UTC(...(startIso.split('-').map(Number) as [number, number, number]))
    const endMs = Date.UTC(year, month - 1, day)
    const totalDays = Math.floor((endMs - startMs) / 86400000) + 1
    return totalDays % 7 === 0
  }

  // Monthly: endDate is the last day of its month (UTC)
  if (g === 'monthly') {
    const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return day === lastDayOfMonth
  }

  // Yearly: endDate is the last day of the year (UTC)
  return month === 12 && day === 31
})

const supportsEstimation = computed(
  () =>
    !['daily', 'weekly'].includes(displayedGranularity.value) &&
    selectedMetric.value !== 'contributors',
)

const hasDownloadAnomalies = computed(() =>
  normalisedDataset.value?.some(datapoint => !!datapoint?.dashIndices?.length),
)

const shouldRenderEstimationOverlay = computed(() => !pending.value && supportsEstimation.value)

const startDate = usePermalink<string>('start', '', {
  permanent: props.permalink,
})
const endDate = usePermalink<string>('end', '', {
  permanent: props.permalink,
})

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
  if (!isMultiPackageMode.value && props.defaultRange === 'auto') return
  if (startDate.value && endDate.value) return

  const today = new Date()
  const yesterday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
  )

  endDate.value = toUtcDateOnly(yesterday)
  startDate.value = toUtcDateOnly(addUtcDays(yesterday, -(52 * 7) + 1))
}

watch(
  () => (props.packageNames ?? []).length || props.defaultRange === '52-weeks',
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

type MetricId = 'downloads' | 'likes' | 'contributors'
const DEFAULT_METRIC_ID: MetricId = 'downloads'

type MetricContext = {
  packageName: string
  repoRef?: RepoRef | null
}

type MetricDef = {
  id: MetricId
  label: string
  fetch: (context: MetricContext, options: EvolutionOptions) => Promise<EvolutionData>
  supportsMulti?: boolean
}

const METRICS = computed<MetricDef[]>(() => {
  const metrics: MetricDef[] = [
    {
      id: 'downloads',
      label: $t('package.trends.items.downloads'),
      fetch: ({ packageName }, opts) =>
        fetchPackageDownloadEvolution(
          packageName,
          props.createdIso ?? null,
          opts,
        ) as Promise<EvolutionData>,
      supportsMulti: true,
    },
    {
      id: 'likes',
      label: $t('package.trends.items.likes'),
      fetch: ({ packageName }, opts) => fetchPackageLikesEvolution(packageName, opts),
      supportsMulti: true,
    },
    {
      id: 'contributors',
      label: $t('package.trends.items.contributors'),
      fetch: ({ repoRef }, opts) => fetchRepoContributorsEvolution(repoRef, opts),
      supportsMulti: true,
    },
  ]

  return metrics
})

const selectedMetric = usePermalink<MetricId>('facet', DEFAULT_METRIC_ID, {
  permanent: props.permalink,
})

const effectivePackageNamesForMetric = computed<string[]>(() => {
  if (!isMultiPackageMode.value) return effectivePackageNames.value
  if (selectedMetric.value !== 'contributors') return effectivePackageNames.value
  return effectivePackageNames.value.filter(
    name => repoRefsByPackage.value[name]?.provider === 'github',
  )
})

const skippedPackagesWithoutGitHub = computed(() => {
  if (!isMultiPackageMode.value) return []
  if (selectedMetric.value !== 'contributors') return []
  if (!effectivePackageNames.value.length) return []

  return effectivePackageNames.value.filter(
    name => repoRefsByPackage.value[name]?.provider !== 'github',
  )
})

const availableGranularities = computed<ChartTimeGranularity[]>(() => {
  if (selectedMetric.value === 'contributors') {
    return ['weekly', 'monthly', 'yearly']
  }

  return ['daily', 'weekly', 'monthly', 'yearly']
})

watch(
  () => [selectedMetric.value, availableGranularities.value] as const,
  () => {
    if (!availableGranularities.value.includes(selectedGranularity.value)) {
      selectedGranularity.value = 'weekly'
    }
  },
  { immediate: true },
)

watch(
  () => METRICS.value,
  metrics => {
    if (!metrics.some(m => m.id === selectedMetric.value)) {
      selectedMetric.value = DEFAULT_METRIC_ID
    }
  },
  { immediate: true },
)

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
  contributors: {
    pending: false,
    evolution: [],
    evolutionsByPackage: {},
    requestToken: 0,
  },
})

const activeMetricState = computed(() => metricStates[selectedMetric.value])
const activeMetricDef = computed(
  () => METRICS.value.find(m => m.id === selectedMetric.value) ?? METRICS.value[0],
)
const pending = computed(() => activeMetricState.value?.pending)

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

  const state = metricStates[metricId]
  const metric = METRICS.value.find(m => m.id === metricId)!
  const currentToken = ++state.requestToken
  state.pending = true

  if (metricId === 'contributors' && repoRefsPending.value) {
    return
  }

  const fetchFn = (context: MetricContext) => metric.fetch(context, options.value)

  try {
    const packageNames = effectivePackageNamesForMetric.value
    if (!packageNames.length) {
      if (isMultiPackageMode.value) state.evolutionsByPackage = {}
      else state.evolution = []
      displayedGranularity.value = selectedGranularity.value
      return
    }

    if (isMultiPackageMode.value) {
      if (metric.supportsMulti === false) {
        state.evolutionsByPackage = {}
        displayedGranularity.value = selectedGranularity.value
        return
      }

      const settled = await Promise.allSettled(
        packageNames.map(async pkg => {
          const repoRef = metricId === 'contributors' ? repoRefsByPackage.value[pkg] : null
          const result = await fetchFn({ packageName: pkg, repoRef })
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

    const result = await fetchFn({
      packageName: pkg,
      repoRef: props.repoRef || repoRefsByPackage.value[pkg],
    })
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
  const repoKey = props.repoRef
    ? `${props.repoRef.provider}:${props.repoRef.owner}/${props.repoRef.repo}`
    : ''
  return [
    isMultiPackageMode.value ? 'M' : 'S',
    names,
    repoKey,
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

watch(
  () => repoRefsByPackage.value,
  () => {
    if (!import.meta.client) return
    if (!isMounted.value) return
    if (selectedMetric.value !== 'contributors') return
    debouncedLoadNow()
  },
  { deep: true },
)

const effectiveDataSingle = computed<EvolutionData>(() => {
  const state = activeMetricState.value
  let data: EvolutionData
  if (
    selectedMetric.value === DEFAULT_METRIC_ID &&
    displayedGranularity.value === DEFAULT_GRANULARITY &&
    props.weeklyDownloads?.length
  ) {
    data =
      isWeeklyDataset(state.evolution) && state.evolution.length
        ? state.evolution
        : props.weeklyDownloads
  } else {
    data = state.evolution
  }

  if (isDownloadsMetric.value && data.length) {
    const pkg = effectivePackageNames.value[0] ?? props.packageName ?? ''
    if (settings.value.chartFilter.anomaliesFixed) {
      data = applyBlocklistCorrection({
        data,
        packageName: pkg,
        granularity: displayedGranularity.value,
      })
    }
  }

  return data
})

const maxDatapoints = computed(() =>
  Math.max(0, ...(chartData.value.dataset ?? []).map(d => d.series.length)),
)

// Cached date formatter for tooltip
const tooltipDateFormatter = computed(() => {
  const granularity = displayedGranularity.value
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: granularity === 'yearly' ? undefined : 'short',
    day: granularity === 'daily' || granularity === 'weekly' ? 'numeric' : undefined,
    timeZone: 'UTC',
  })
})

function buildExportFilename(extension: string): string {
  const g = selectedGranularity.value
  const range = `${startDate.value}_${endDate.value}`

  if (!isMultiPackageMode.value) {
    const name = effectivePackageNames.value[0] ?? props.packageName ?? 'package'
    return `${sanitise(applyEllipsis(name, 32))}-${g}_${range}.${extension}`
  }

  const names = effectivePackageNames.value.map(name => applyEllipsis(name, 32))
  const label = names.length === 1 ? names[0] : names.join('_')
  return `${sanitise(label ?? '')}-${g}_${range}.${extension}`
}

const granularityLabels = computed(() => ({
  daily: $t('package.trends.granularity_daily'),
  weekly: $t('package.trends.granularity_weekly'),
  monthly: $t('package.trends.granularity_monthly'),
  yearly: $t('package.trends.granularity_yearly'),
}))

const granularityItems = computed(() =>
  availableGranularities.value.map(granularity => ({
    label: granularityLabels.value[granularity],
    value: granularity,
  })),
)

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
     * - a line overlay covering the plain path between the last datapoint and its ancestor
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
 * In case of label collisions for multiple series:
 * - labels are evenly distributed vertically
 * - an elbowed marker connects the last point to its label
 *
 * Return an empty string when no series data is available.
 *
 * @param svg - SVG context object provided by `VueUiXy` via the `#svg` slot
 * @returns A string containing SVG `<text>` elements, or an empty string when
 * no labels should be rendered.
 */
function drawLastDatapointLabel(svg: VueUiXySvgSlotProps['svg']) {
  return createLastDatapointLabelsSvg({
    series: Array.isArray(svg?.data) ? svg.data : [],
    drawingArea: svg.drawingArea,
    svgWidth: svg.width,
    fontSize: isMultiPackageMode.value ? 20 : 24,
    labelOffset: isMultiPackageMode.value ? 24 : 16,
    colors: {
      foreground: colors.value.fg!,
      background: colors.value.bg!,
      fallbackSerieColor: colors.value.fg!,
    },
    formatValue: value => compactNumberFormatter.value.format(value),
    isDarkMode: isDarkMode.value,
  })
}
/**
 * Build and return a legend to be injected during the SVG export only, since the custom legend is
 * displayed as an independent div, content has to be injected within the chart's viewBox.
 *
 * Legend items are displayed in a column, at the top left of the chart.
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
    (supportsEstimation.value && !isEndDateOnPeriodEnd.value && !isZoomed.value) ||
    hasDownloadAnomalies.value
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

const showCorrectionControls = shallowRef(false)
const isResizing = shallowRef(false)

const chartHeight = computed(() => {
  if (isMobile.value) {
    return 950
  }
  return showCorrectionControls.value && props.inModal ? 494 : 600
})

const { start } = useTimeoutFn(
  () => {
    isResizing.value = false
  },
  200,
  { immediate: false },
)

function pauseChartTransitions() {
  isResizing.value = true
  start()
}

watch(
  chartHeight,
  (newH, oldH) => {
    if (newH !== oldH) {
      // Avoids triggering chart line transitions when the chart is resized
      pauseChartTransitions()
    }
  },
  { immediate: true },
)

const tooltipPosition = useTooltipPosition(chartRef)

const keepZoomState = shallowRef(true)

// VueUiXy chart component configuration
const chartConfig = computed<VueUiXyConfig>(() => {
  const baseConfig = buildTrendsChartConfig({
    packageNames: effectivePackageNames.value,
    effectivePackageNamesForMetric: effectivePackageNamesForMetric.value,
    isMultiPackageMode: isMultiPackageMode.value,
    selectedMetric: selectedMetric.value,
    selectedMetricLabel: activeMetricDef.value?.label ?? '',
    selectedGranularity: selectedGranularity.value,
    displayedGranularity: displayedGranularity.value,
    singleEvolution: effectiveDataSingle.value,
    evolutionsByPackage: activeMetricState.value.evolutionsByPackage,
    dates: chartData.value.dates,
    colors: colors.value,
    accent: accent.value,
    isDarkMode: isDarkMode.value,
    isMobile: isMobile.value,
    pending: pending.value,
    locale: locale.value,
    chartHeight: chartHeight.value,
    inModal: props.inModal,
    chartFilter: settings.value.chartFilter,
    t: $t,
    compactNumberFormatter: compactNumberFormatter.value,
    tooltipPosition: tooltipPosition.value,
  })

  return {
    ...baseConfig,
    chart: {
      ...baseConfig.chart,
      userOptions: {
        ...baseConfig?.chart?.userOptions,
        callbacks: {
          img: args => {
            const imageUri = args?.imageUri
            if (!imageUri) return
            downloadFileLink(imageUri, buildExportFilename('png'))
          },
          csv: csvStr => {
            if (!csvStr) return
            const blob = new Blob([csvStr.replace('data:text/csv;charset=utf-8,', '')])
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
          altCopy: ({ dataset: copiedDataset, config: copiedConfig }) =>
            copyAltTextForTrendLineChart({
              dataset: copiedDataset,
              config: {
                ...copiedConfig,
                formattedDatasetValues: (copiedDataset?.lines || []).map(serie =>
                  serie.series.map(value => compactNumberFormatter.value.format(value ?? 0)),
                ),
                hasEstimation:
                  supportsEstimation.value && !isEndDateOnPeriodEnd.value && !isZoomed.value,
                granularity: displayedGranularity.value,
                copy,
                $t,
                numberFormatter: compactNumberFormatter.value.format,
              },
            }),
        },
      },
      tooltip: {
        ...baseConfig?.chart?.tooltip,
        customFormat: ({ datapoint: items, absoluteIndex }) => {
          if (!items || pending.value) return ''

          const hasMultipleItems = items.length > 1
          let formattedDate = ''

          if (hasMultipleItems && absoluteIndex !== undefined) {
            const index = Number(absoluteIndex)
            const timestamp = chartData.value.dates[index]

            if (Number.isInteger(index) && typeof timestamp === 'number') {
              formattedDate = tooltipDateFormatter.value.format(new Date(timestamp))
            }
          }

          const rows = items
            .map((datapoint: Record<string, any>) => {
              const label = String(datapoint?.name ?? '').trim()
              const rawValue = Number(datapoint?.value ?? 0)
              const value = compactNumberFormatter.value.format(
                Number.isFinite(rawValue) ? rawValue : 0,
              )

              if (!hasMultipleItems) {
                return `<div>
                  <span class="text-base text-[var(--fg)] font-mono tabular-nums">${value}</span>
                </div>`
              }

              return `<div class="grid grid-cols-[12px_minmax(0,1fr)_max-content] items-center gap-x-3">
                <div class="w-3 h-3">
                  <svg viewBox="0 0 2 2" class="w-full h-full">
                    <rect x="0" y="0" width="2" height="2" rx="0.3" fill="${datapoint.color}" />
                  </svg>
                </div>
                <span class="text-3xs uppercase tracking-wide text-[var(--fg)]/70 truncate">${label}</span>
                <span class="text-base text-[var(--fg)] font-mono tabular-nums text-end">${value}</span>
              </div>`
            })
            .join('')

          return `<div class="font-mono text-xs p-3 border border-border rounded-md bg-[var(--bg)]/10 backdrop-blur-md">
            ${formattedDate ? `<div class="text-2xs text-[var(--fg-subtle)] mb-2">${formattedDate}</div>` : ''}
            <div class="${hasMultipleItems ? 'flex flex-col gap-2' : ''}">${rows}</div>
          </div>`
        },
      },
      zoom: {
        maxWidth: isMobile.value ? 350 : 500,
        highlightColor: colors.value.bgElevated,
        useResetSlot: true,
        keepState: keepZoomState.value,
        minimap: {
          show: true,
          lineColor: '#FAFAFA',
          selectedColor: accent.value,
          selectedColorOpacity: 0.06,
          frameColor: colors.value.border,
          handleWidth: isMobile.value ? 40 : 20,
          handleBorderColor: colors.value.fgSubtle,
          handleType: 'grab',
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

const isDownloadsMetric = computed(() => selectedMetric.value === 'downloads')

const packageAnomalies = computed(() => getAnomaliesForPackages(effectivePackageNames.value))
const hasAnomalies = computed(() => packageAnomalies.value.length > 0)

function formatAnomalyDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  if (!y || !m || !d) return dateStr
  return new Intl.DateTimeFormat(locale.value, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, d)))
}

// Trigger data loading when the metric is switched
watch(selectedMetric, value => {
  if (!isMounted.value) return
  loadMetric(value)
})

// Sparkline charts (a11y alternative display for multi series)
const chartLayout = usePermalink<'combined' | 'split'>('layout', 'combined')
const isSparklineLayout = computed({
  get: () => chartLayout.value === 'split',
  set: (v: boolean) => {
    chartLayout.value = v ? 'split' : 'combined'
  },
})

const { start: resetZoomState } = useTimeoutFn(
  () => {
    keepZoomState.value = true
  },
  1000,
  { immediate: false },
)

async function resetZoom() {
  keepZoomState.value = false
  await nextTick()
  chartRef.value?.resetZoom?.()
  resetZoomState()
}

onMounted(resetZoom)

watch([selectedGranularity, startDate, endDate], async () => {
  if (!isMounted.value) return
  await resetZoom()
})

watch(
  () => activeMetricState.value?.pending,
  async (currentPending, previousPending) => {
    if (previousPending && !currentPending) {
      await resetZoom()
    }
  },
)

const embedQuery = reactive({
  metric: 'downloads',
  startDate: startDate.value,
  endDate: endDate.value,
  mode: isDarkMode.value ? 'dark' : 'light',
})

watch(startDate, value => {
  embedQuery.startDate = value
})

watch(endDate, value => {
  embedQuery.endDate = value
})

const isEmbedDarkMode = shallowRef(true)

watch(isEmbedDarkMode, value => {
  embedQuery.mode = value ? 'dark' : 'light'
})

watch(
  isDarkMode,
  value => {
    isEmbedDarkMode.value = value
  },
  { immediate: true },
)

function getGranularityLabel(granularity: ChartTimeGranularity): string {
  switch (granularity) {
    case 'daily':
      return $t('package.trends.granularity_daily')
    case 'weekly':
      return $t('package.trends.granularity_weekly')
    case 'monthly':
      return $t('package.trends.granularity_monthly')
    case 'yearly':
      return $t('package.trends.granularity_yearly')
  }
}

const embedUrl = computed(() => {
  const query = new URLSearchParams({
    packages: effectivePackageNames.value.join(','),
    metric: embedQuery.metric,
    startDate: embedQuery.startDate,
    endDate: embedQuery.endDate,
    mode: embedQuery.mode,
    granularity: selectedGranularity.value,
    locale: locale.value,
    accent: accent.value,
    yLabel: $t('package.trends.y_axis_label', {
      granularity: getGranularityLabel(selectedGranularity.value),
      facet: METRICS.value.find(metric => metric.id === selectedMetric.value)?.label,
    }),
  })

  const path = `/api/embed/downloads.svg?${query.toString()}`

  return import.meta.client ? new URL(path, window.location.origin).toString() : path
})

const showEmbedFields = shallowRef(false)
const { copy: copyEmbed, copied: copiedEmbedUrl } = useClipboard({
  copiedDuring: 2000,
})
const copyEmbedUrl = () => copyEmbed(embedUrl.value)
</script>

<template>
  <div
    class="w-full relative"
    id="trends-chart"
    :aria-busy="activeMetricState.pending ? 'true' : 'false'"
  >
    <TabRoot
      v-if="isMultiPackageMode"
      v-model="chartLayout"
      id-prefix="chart-layout"
      class="mt-4 mb-8"
    >
      <TabList :ariaLabel="$t('package.trends.chart_view_toggle')">
        <TabItem value="combined" tab-id="combined-chart-layout-tab" icon="i-lucide:chart-line">
          {{ $t('package.trends.chart_view_combined') }}
        </TabItem>
        <TabItem
          value="split"
          tab-id="split-chart-layout-tab"
          icon="i-lucide:square-split-horizontal"
        >
          {{ $t('package.trends.chart_view_split') }}
        </TabItem>
      </TabList>
    </TabRoot>

    <div class="w-full mb-4 flex flex-col gap-3">
      <div class="grid grid-cols-2 sm:flex sm:flex-row gap-3 sm:gap-2 sm:items-end">
        <SelectField
          v-if="showFacetSelector"
          id="trends-metric-select"
          v-model="selectedMetric"
          :disabled="activeMetricState.pending"
          :items="METRICS.map(m => ({ label: m.label, value: m.id }))"
          :label="$t('package.trends.facet')"
          block
        />

        <SelectField
          :label="$t('package.trends.granularity')"
          id="granularity"
          v-model="selectedGranularity"
          :disabled="activeMetricState.pending"
          :items="granularityItems"
          block
        />

        <div class="col-span-2 sm:col-span-1 grid grid-cols-2 gap-2 flex-1">
          <div class="flex flex-col gap-1">
            <label
              for="startDate"
              class="text-2xs font-mono text-fg-subtle tracking-wide uppercase"
            >
              {{ $t('package.trends.start_date') }}
            </label>
            <div class="relative flex items-center">
              <InputBase
                id="startDate"
                v-model="startDate"
                type="date"
                :max="DATE_INPUT_MAX"
                class="w-full min-w-0 bg-transparent"
              />
            </div>
          </div>

          <div class="flex flex-col gap-1">
            <label for="endDate" class="text-2xs font-mono text-fg-subtle tracking-wide uppercase">
              {{ $t('package.trends.end_date') }}
            </label>
            <div class="relative flex items-center">
              <InputBase
                id="endDate"
                v-model="endDate"
                type="date"
                :max="DATE_INPUT_MAX"
                class="w-full min-w-0 bg-transparent"
              />
            </div>
          </div>
        </div>

        <button
          v-if="showResetButton"
          :aria-expanded="showCorrectionControls"
          aria-controls="trends-correction-controls"
          type="button"
          aria-label="Reset date range"
          class="self-end flex items-center justify-center px-2.5 py-2.25 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-accent/70 sm:mb-0"
          @click="resetDateRange"
        >
          <span class="block i-lucide:undo-2 w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <!-- Download filter controls -->
      <div v-if="isDownloadsMetric" class="flex flex-col gap-2">
        <button
          type="button"
          class="self-start flex items-center gap-1 text-2xs font-mono text-fg-subtle hover:text-fg transition-colors"
          @click="showCorrectionControls = !showCorrectionControls"
        >
          <span
            class="w-3.5 h-3.5 transition-transform"
            :class="showCorrectionControls ? 'i-lucide:chevron-down' : 'i-lucide:chevron-right'"
            aria-hidden="true"
          />
          {{ $t('package.trends.data_correction') }}
        </button>
        <div
          class="overflow-hidden transition-[opacity] duration-200 ease-out"
          id="trends-correction-controls"
          :aria-hidden="!showCorrectionControls"
          :inert="!showCorrectionControls"
          :class="
            showCorrectionControls
              ? 'max-h-[220px] opacity-100'
              : 'max-h-0 opacity-0 pointer-events-none'
          "
        >
          <div class="pt-1 min-h-[160px] sm:min-h-[76px]">
            <div class="grid grid-cols-2 sm:flex items-end gap-3">
              <label class="flex flex-col gap-1 flex-1">
                <span class="text-2xs font-mono text-fg-subtle tracking-wide uppercase">
                  {{ $t('package.trends.average_window') }}
                  <span class="text-fg-muted">({{ settings.chartFilter.averageWindow }})</span>
                </span>
                <input
                  v-model.number="settings.chartFilter.averageWindow"
                  :disabled="!showCorrectionControls"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  class="accent-[var(--accent-color,var(--fg-subtle))]"
                />
              </label>
              <label class="flex flex-col gap-1 flex-1">
                <span class="text-2xs font-mono text-fg-subtle tracking-wide uppercase">
                  {{ $t('package.trends.smoothing') }}
                  <span class="text-fg-muted">({{ settings.chartFilter.smoothingTau }})</span>
                </span>
                <input
                  v-model.number="settings.chartFilter.smoothingTau"
                  :disabled="!showCorrectionControls"
                  type="range"
                  min="0"
                  max="20"
                  step="1"
                  class="accent-[var(--accent-color,var(--fg-subtle))]"
                />
              </label>
              <label class="flex flex-col gap-1 flex-1">
                <span class="text-2xs font-mono text-fg-subtle tracking-wide uppercase">
                  {{ $t('package.trends.prediction') }}
                  <span class="text-fg-muted">({{ settings.chartFilter.predictionPoints }})</span>
                </span>
                <input
                  v-model.number="settings.chartFilter.predictionPoints"
                  :disabled="!showCorrectionControls"
                  type="range"
                  min="0"
                  max="30"
                  step="1"
                  class="accent-[var(--accent-color,var(--fg-subtle))]"
                />
              </label>
              <div class="flex flex-col gap-1 shrink-0">
                <span
                  class="text-2xs font-mono text-fg-subtle tracking-wide uppercase flex items-center justify-between"
                >
                  {{ $t('package.trends.known_anomalies') }}
                  <TooltipApp
                    interactive
                    :to="inModal ? '#chart-modal' : undefined"
                    v-if="showCorrectionControls"
                  >
                    <button
                      type="button"
                      class="i-lucide:info w-3.5 h-3.5 text-fg-muted cursor-help"
                      :aria-label="$t('package.trends.known_anomalies')"
                    />
                    <template #content>
                      <div class="flex flex-col gap-3">
                        <p class="text-xs text-fg-muted">
                          {{ $t('package.trends.known_anomalies_description') }}
                        </p>
                        <div v-if="hasAnomalies">
                          <p class="text-xs text-fg-subtle font-medium">
                            {{ $t('package.trends.known_anomalies_ranges') }}
                          </p>
                          <ul class="text-xs text-fg-subtle list-disc list-inside">
                            <li v-for="a in packageAnomalies" :key="`${a.packageName}-${a.start}`">
                              {{
                                isMultiPackageMode
                                  ? $t('package.trends.known_anomalies_range_named', {
                                      packageName: a.packageName,
                                      start: formatAnomalyDate(a.start),
                                      end: formatAnomalyDate(a.end),
                                    })
                                  : $t('package.trends.known_anomalies_range', {
                                      start: formatAnomalyDate(a.start),
                                      end: formatAnomalyDate(a.end),
                                    })
                              }}
                            </li>
                          </ul>
                        </div>
                        <p v-else class="text-xs text-fg-muted">
                          {{
                            $t('package.trends.known_anomalies_none', effectivePackageNames.length)
                          }}
                        </p>
                        <div class="flex justify-end">
                          <LinkBase
                            to="https://github.com/npmx-dev/npmx.dev/edit/main/app/utils/download-anomalies.data.ts"
                            class="text-xs text-accent"
                          >
                            {{ $t('package.trends.known_anomalies_contribute') }}
                          </LinkBase>
                        </div>
                      </div>
                    </template>
                  </TooltipApp>
                </span>
                <label
                  class="flex items-center gap-1.5 text-2xs font-mono text-fg-subtle cursor-pointer h-4"
                  :class="{ 'opacity-50': !hasAnomalies }"
                >
                  <input
                    :checked="settings.chartFilter.anomaliesFixed"
                    :disabled="!showCorrectionControls"
                    @change="
                      settings.chartFilter.anomaliesFixed = (
                        $event.target as HTMLInputElement
                      ).checked
                    "
                    type="checkbox"
                    class="accent-[var(--accent-color,var(--fg-subtle))]"
                  />
                  {{ $t('package.trends.apply_correction') }}
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p v-if="skippedPackagesWithoutGitHub.length > 0" class="text-2xs font-mono text-fg-subtle">
        {{ $t('package.trends.contributors_skip', { count: skippedPackagesWithoutGitHub.length }) }}
        {{ skippedPackagesWithoutGitHub.join(', ') }}
      </p>
    </div>

    <h2 id="trends-chart-title" class="sr-only">
      {{ $t('package.trends.title') }} — {{ activeMetricDef?.label }}
    </h2>

    <!-- Chart panel (active metric) -->
    <div
      role="region"
      aria-labelledby="trends-chart-title"
      :class="
        isSparklineLayout || !inModal
          ? undefined
          : isMobile === false && width > 0
            ? showCorrectionControls
              ? 'h-[491px]'
              : 'h-[567px]'
            : 'min-h-[260px]'
      "
    >
      <ClientOnly v-if="chartData.dataset">
        <div
          v-if="isSparklineLayout"
          id="split-chart-layout-panel"
          :role="isMultiPackageMode ? 'tabpanel' : undefined"
          :aria-labelledby="isMultiPackageMode ? 'split-chart-layout-tab' : undefined"
        >
          <ChartSplitSparkline
            :dataset="normalisedDataset"
            :dates="chartData.dates"
            :datetimeFormatterOptions
            :showLastDatapointEstimation="shouldRenderEstimationOverlay && !isEndDateOnPeriodEnd"
          />
        </div>

        <div
          :data-pending="pending"
          :data-minimap-visible="maxDatapoints > 6"
          v-else
          id="combined-chart-layout-panel"
          :role="isMultiPackageMode ? 'tabpanel' : undefined"
          :aria-labelledby="isMultiPackageMode ? 'combined-chart-layout-tab' : undefined"
        >
          <VueUiXy
            ref="chartRef"
            :dataset="normalisedDataset"
            :config="chartConfig"
            :class="{
              '[direction:ltr]': true,
              'no-transition': isResizing,
            }"
            @zoomStart="setIsZoom"
            @zoomEnd="setIsZoom"
            @zoomReset="isZoomed = false"
          >
            <!-- Keyboard navigation hint -->
            <template #hint="{ isVisible }">
              <p v-if="isVisible" class="text-accent text-xs -mt-6 text-center" aria-hidden="true">
                {{ $t('compare.packages.line_chart_nav_hint') }}
              </p>
            </template>

            <!-- Injecting custom svg elements -->
            <template #svg="{ svg }">
              <!-- Estimation lines for monthly & yearly granularities when the end date induces a downwards trend -->
              <g
                v-if="shouldRenderEstimationOverlay && !isEndDateOnPeriodEnd && !isZoomed"
                v-html="drawEstimationLine(svg)"
              />

              <!-- Last value label for all other cases -->
              <g v-if="!pending" v-html="drawLastDatapointLabel(svg)" />

              <!-- Inject legend during SVG print only -->
              <g v-if="svg.isPrintingSvg" v-html="drawSvgPrintLegend(svg)" />

              <!-- Inject npmx logo & tagline during SVG and PNG print -->
              <g
                v-if="svg.isPrintingSvg || svg.isPrintingImg"
                v-html="
                  drawNpmxLogoAndTaglineWatermark({
                    svg,
                    colors: watermarkColors,
                    translateFn: $t,
                    positioning: 'bottom',
                  })
                "
              />

              <!-- Overlay covering the chart area to hide line resizing when switching granularities recalculates VueUiXy scaleMax when estimation lines are necessary -->
              <rect
                v-if="pending"
                :x="svg.drawingArea.left - 3"
                :y="svg.drawingArea.top - 12"
                :width="svg.drawingArea.width + 15"
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
              <div class="flex gap-x-6 gap-y-2 flex-wrap justify-center text-sm">
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
                  v-if="supportsEstimation || hasDownloadAnomalies"
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

            <!-- Custom minimap reset button -->
            <template #reset-action="{ reset: resetMinimap }">
              <button
                type="button"
                aria-label="reset minimap"
                class="absolute inset-is-1/2 -translate-x-1/2 -bottom-18 sm:inset-is-unset sm:translate-x-0 sm:bottom-auto sm:-inset-ie-20 sm:-top-3 flex items-center justify-center px-2.5 py-1.75 border border-transparent rounded-md text-fg-subtle hover:text-fg transition-colors hover:border-border focus-visible:outline-accent/70 sm:mb-0"
                style="pointer-events: all !important"
                @click="resetMinimap"
              >
                <span class="i-lucide:undo-2 w-5 h-5" aria-hidden="true" />
              </button>
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
            <template #optionStack="{ isStack }">
              <span
                v-if="isStack"
                class="i-lucide:layers-2 text-fg-subtle w-6 h-6 pointer-events-none"
                aria-hidden="true"
              />
              <span
                v-else
                class="i-lucide:chart-line text-fg-subtle w-6 h-6 pointer-events-none"
                aria-hidden="true"
              />
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

    <!-- Chart embedding -->
    <div v-if="isDownloadsMetric && !!chartData.dataset">
      <div class="flex flex-col gap-2">
        <button
          type="button"
          :aria-expanded="showEmbedFields"
          aria-controls="trends-embed-chart"
          class="self-start flex items-center gap-1 text-2xs font-mono text-fg-subtle hover:text-fg transition-colors"
          @click="showEmbedFields = !showEmbedFields"
        >
          <span
            class="w-3.5 h-3.5 transition-transform"
            :class="showEmbedFields ? 'i-lucide:chevron-down' : 'i-lucide:chevron-right'"
            aria-hidden="true"
          />
          {{ $t('package.trends.embedding.chart') }}
        </button>
      </div>
      <div
        class="overflow-hidden transition-[opacity] duration-200 ease-out"
        id="trends-embed-chart"
        :aria-hidden="!showEmbedFields"
        :inert="!showEmbedFields"
        :class="
          showEmbedFields ? 'max-h-[400px] opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        "
      >
        <div class="flex flex-col gap-2">
          <div class="flex flex-row flex-wrap gap-2 mt-2">
            <SettingsToggle v-model="isEmbedDarkMode" :label="$t('command_palette.theme.dark')" />
          </div>
          <div class="text-sm text-fg-subtle flex gap-1">
            {{ $t('package.trends.embedding.copy_url') }}
            <TooltipApp
              :text="$t('package.trends.embedding.tip')"
              interactive
              :to="inModal ? '#chart-modal' : undefined"
              position="top"
            >
              <span
                tabindex="0"
                class="inline-flex items-center justify-center min-w-6 min-h-6 -m-1 p-1 text-fg-subtle hover:text-fg transition-colors cursor-help focus-visible:outline-2 focus-visible:outline-accent/70 rounded"
              >
                <span class="i-lucide:info w-3 h-3" aria-hidden="true" />
              </span>
            </TooltipApp>
          </div>
          <div class="flex flex-row gap-4 flex-wrap">
            <div
              class="bg-bg-subtle border border-border rounded-md shadow-lg text-xs break-all p-4 pt-8 relative"
            >
              <ButtonBase
                class="absolute top-1 force-right-1"
                size="sm"
                @click="copyEmbedUrl"
                :aria-pressed="copiedEmbedUrl"
                :aria-label="copiedEmbedUrl ? $t('common.copied') : $t('common.copy')"
                :classicon="copiedEmbedUrl ? 'i-lucide:check' : 'i-lucide:chart-line'"
              >
                <span>{{ copiedEmbedUrl ? $t('common.copied') : $t('common.copy') }}</span>
              </ButtonBase>
              {{ embedUrl }}
            </div>
            <div>
              <span class="text-xs text-fg-subtle mb-2">
                {{ $t('package.trends.embedding.preview') }}
              </span>
              <img
                class="rounded border border-border w-full max-w-50"
                :src="embedUrl"
                :alt="$t('package.trends.embedding.preview')"
              />
            </div>
          </div>
        </div>
      </div>
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
    left: calc(100% + 4rem) !important;
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

.no-transition line,
.no-transition circle {
  transition: none !important;
}

input::-webkit-date-and-time-value {
  margin-inline: 4px;
}
</style>
