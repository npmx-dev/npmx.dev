import type { MaybeRefOrGetter } from 'vue'
import { toValue } from 'vue'
import type {
  VersionDistributionResponse,
  VersionGroupDownloads,
  VersionGroupingMode,
} from '#shared/types/version-downloads'

interface ChartDataItem {
  name: string
  downloads: number
}

/**
 * Composable for managing version download distribution data and state.
 *
 * Fetches version download statistics from the API, manages grouping/filtering state,
 * and formats data for chart visualization.
 *
 * @param packageName - The package name to fetch version downloads for
 * @returns Reactive state and computed chart data
 */
export function useVersionDistribution(packageName: MaybeRefOrGetter<string>) {
  const groupingMode = ref<VersionGroupingMode>('major')
  const showRecentOnly = ref(false)
  const showLowUsageVersions = ref(false)
  const pending = ref(false)
  const error = ref<Error | null>(null)
  const data = ref<VersionDistributionResponse | null>(null)

  /**
   * Fetches version download distribution from the API
   */
  async function fetchDistribution() {
    const pkgName = toValue(packageName)
    if (!pkgName) {
      data.value = null
      return
    }

    pending.value = true
    error.value = null

    try {
      const mode = groupingMode.value
      const response = await $fetch<VersionDistributionResponse>(
        `/api/registry/downloads/${encodeURIComponent(pkgName)}/versions`,
        {
          query: {
            mode,
            filterOldVersions: showRecentOnly.value ? 'true' : 'false',
            filterThreshold: showLowUsageVersions.value ? '0' : '1',
          },
          cache: 'default', // Don't force-cache since query params change frequently
        },
      )

      data.value = response
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Failed to fetch version distribution')
      data.value = null
    } finally {
      pending.value = false
    }
  }

  /**
   * Applies filtering to version groups based on current filter settings
   * Sorts groups from oldest to newest version
   */
  const filteredGroups = computed<VersionGroupDownloads[]>(() => {
    if (!data.value) return []

    let groups = data.value.groups

    // Filter using server-provided recent versions list
    if (showRecentOnly.value && data.value.recentVersions) {
      const recentVersionsSet = new Set(data.value.recentVersions)

      groups = groups.filter(group => {
        return group.versions.some(v => {
          // Check exact version match
          if (recentVersionsSet.has(v.version)) return true

          // Also check base version (strip prerelease suffix)
          if (v.version.includes('-')) {
            const baseVersion = v.version.split('-')[0]
            if (baseVersion && recentVersionsSet.has(baseVersion)) return true
          }

          return false
        })
      })
    }

    // Sort groups from oldest to newest by parsing version numbers
    return groups.slice().sort((a, b) => {
      // Extract version numbers from groupKey (e.g., "1.x" or "1.2.x")
      const aParts = a.groupKey.replace(/\.x$/, '').split('.').map(Number)
      const bParts = b.groupKey.replace(/\.x$/, '').split('.').map(Number)

      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aPart = aParts[i] ?? 0
        const bPart = bParts[i] ?? 0
        if (aPart !== bPart) {
          return aPart - bPart
        }
      }
      return 0
    })
  })

  const chartDataset = computed<ChartDataItem[]>(() => {
    const groups = filteredGroups.value
    if (!groups.length) return []

    return groups.map(group => ({
      name: group.label,
      downloads: group.downloads,
    }))
  })

  const totalDownloads = computed(() => {
    const groups = filteredGroups.value
    if (!groups || !groups.length) return 0
    return groups.reduce((sum, group) => sum + group.downloads, 0)
  })

  const hasData = computed(() => {
    return data.value !== null && filteredGroups.value.length > 0
  })

  // Refetch when filter changes - no immediate since we already have data
  watch(showRecentOnly, () => {
    fetchDistribution()
  })

  watch(showLowUsageVersions, () => {
    fetchDistribution()
  })

  // Refetch when grouping mode changes - immediate to load initial data
  watch(
    groupingMode,
    () => {
      fetchDistribution()
    },
    { immediate: true },
  )

  // Refetch when package name changes - not immediate since parent component controls initialization
  watch(
    () => toValue(packageName),
    () => {
      fetchDistribution()
    },
    { immediate: false },
  )

  return {
    // State
    groupingMode,
    showRecentOnly,
    showLowUsageVersions,
    pending,
    error,
    // Computed
    filteredGroups,
    chartDataset,
    totalDownloads,
    hasData,
    // Methods
    fetchDistribution,
  }
}
