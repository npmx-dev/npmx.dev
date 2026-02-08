import type {
  FacetValue,
  ComparisonFacet,
  ComparisonPackage,
  Packument,
  VulnerabilityTreeResult,
} from '#shared/types'
import type { PackageLikes } from '#shared/types/social'
import { encodePackageName } from '#shared/utils/npm'
import type { PackageAnalysisResponse } from './usePackageAnalysis'
import { isBinaryOnlyPackage } from '#shared/utils/binary-detection'
import { getDependencyCount } from '~/utils/npm/dependency-count'

/** Special identifier for the "What Would James Do?" comparison column */
export const NO_DEPENDENCY_ID = '__no_dependency__'

/**
 * Special display values for the "no dependency" column.
 * These are explicit markers that get special rendering treatment.
 */
export const NoDependencyDisplay = {
  /** Display as "–" (en-dash) */
  DASH: '__display_dash__',
  /** Display as "Up to you!" with good status */
  UP_TO_YOU: '__display_up_to_you__',
} as const

export interface PackageComparisonData {
  package: ComparisonPackage
  downloads?: number
  /** Total likes from atproto */
  totalLikes?: number
  /** Package's own unpacked size (from dist.unpackedSize) */
  packageSize?: number
  /** Number of direct dependencies */
  directDeps: number | null
  /** Install size data (fetched lazily) */
  installSize?: {
    selfSize: number
    totalSize: number
    /** Total dependency count */
    dependencyCount: number
  }
  analysis?: PackageAnalysisResponse
  vulnerabilities?: {
    count: number
    severity: { critical: number; high: number; moderate: number; low: number }
  }
  metadata?: {
    license?: string
    /**
     * Publish date of this version (ISO 8601 date-time string).
     * Uses `time[version]` from the registry, NOT `time.modified`.
     * For example, if the package was most recently published 3 years ago
     * but a maintainer was removed last week, this would show the '3 years ago' time.
     */
    lastUpdated?: string
    engines?: { node?: string; npm?: string }
    deprecated?: string
  }
  /** Whether this is a binary-only package (CLI without library entry points) */
  isBinaryOnly?: boolean
  /** Marks this as the "no dependency" column for special display */
  isNoDependency?: boolean
}

/**
 * Composable for fetching and comparing multiple packages.
 *
 */
export function usePackageComparison(packageNames: MaybeRefOrGetter<string[]>) {
  const { t } = useI18n()
  const numberFormatter = useNumberFormatter()
  const compactNumberFormatter = useCompactNumberFormatter()
  const bytesFormatter = useBytesFormatter()
  const packages = computed(() => toValue(packageNames))

  // Cache of fetched data by package name (source of truth)
  const cache = shallowRef(new Map<string, PackageComparisonData>())

  // Derived array in current package order
  const packagesData = computed(() => packages.value.map(name => cache.value.get(name) ?? null))

  const status = shallowRef<'idle' | 'pending' | 'success' | 'error'>('idle')
  const error = shallowRef<Error | null>(null)

  // Track which packages are currently being fetched
  const loadingPackages = shallowRef(new Set<string>())

  // Track install size loading separately (it's slower)
  const installSizeLoading = shallowRef(false)

  // Fetch function - only fetches packages not already in cache
  async function fetchPackages(names: string[]) {
    if (names.length === 0) {
      status.value = 'idle'
      return
    }

    // Handle "no dependency" column - add to cache immediately
    if (names.includes(NO_DEPENDENCY_ID) && !cache.value.has(NO_DEPENDENCY_ID)) {
      const newCache = new Map(cache.value)
      newCache.set(NO_DEPENDENCY_ID, createNoDependencyData())
      cache.value = newCache
    }

    // Only fetch packages not already cached (excluding "no dep" which has no remote data)
    const namesToFetch = names.filter(name => name !== NO_DEPENDENCY_ID && !cache.value.has(name))

    if (namesToFetch.length === 0) {
      status.value = 'success'
      return
    }

    status.value = 'pending'
    error.value = null

    // Mark packages as loading
    loadingPackages.value = new Set(namesToFetch)

    try {
      // First pass: fetch fast data (package info, downloads, analysis, vulns)
      const results = await Promise.all(
        namesToFetch.map(async (name): Promise<PackageComparisonData | null> => {
          try {
            // Fetch basic package info first (required)
            const pkgData = await $fetch<Packument>(
              `https://registry.npmjs.org/${encodePackageName(name)}`,
            )

            const latestVersion = pkgData['dist-tags']?.latest
            if (!latestVersion) return null

            // Fetch fast additional data in parallel (optional - failures are ok)
            const [downloads, analysis, vulns, likes] = await Promise.all([
              $fetch<{ downloads: number }>(
                `https://api.npmjs.org/downloads/point/last-week/${encodePackageName(name)}`,
              ).catch(() => null),
              $fetch<PackageAnalysisResponse>(
                `/api/registry/analysis/${encodePackageName(name)}`,
              ).catch(() => null),
              $fetch<VulnerabilityTreeResult>(
                `/api/registry/vulnerabilities/${encodePackageName(name)}`,
              ).catch(() => null),
              $fetch<PackageLikes>(`/api/social/likes/${name}`).catch(() => null),
            ])
            const versionData = pkgData.versions[latestVersion]
            const packageSize = versionData?.dist?.unpackedSize

            // Detect if package is binary-only
            const isBinary = isBinaryOnlyPackage({
              name: pkgData.name,
              bin: versionData?.bin,
              main: versionData?.main,
              module: versionData?.module,
              exports: versionData?.exports,
            })

            // Vulnerabilities
            let vulnsTotal: number = 0
            let vulnsSeverity = { critical: 0, high: 0, moderate: 0, low: 0 }

            if (vulns) {
              const { total, ...severity } = vulns.totalCounts
              vulnsTotal = total
              vulnsSeverity = severity
            }

            return {
              package: {
                name: pkgData.name,
                version: latestVersion,
                description: undefined,
              },
              downloads: downloads?.downloads,
              packageSize,
              directDeps: versionData ? getDependencyCount(versionData) : null,
              installSize: undefined, // Will be filled in second pass
              analysis: analysis ?? undefined,
              vulnerabilities: {
                count: vulnsTotal,
                severity: vulnsSeverity,
              },
              metadata: {
                license:
                  typeof pkgData.license === 'object' && 'type' in pkgData.license
                    ? pkgData.license.type
                    : pkgData.license,
                // Use version-specific publish time, NOT time.modified (which can be
                // updated by metadata changes like maintainer additions)
                lastUpdated: pkgData.time?.[latestVersion],
                engines: analysis?.engines,
                deprecated: versionData?.deprecated,
              },
              isBinaryOnly: isBinary,
              totalLikes: likes?.totalLikes,
            }
          } catch {
            return null
          }
        }),
      )

      // Add results to cache
      const newCache = new Map(cache.value)
      for (const [i, name] of namesToFetch.entries()) {
        const data = results[i]
        if (data) {
          newCache.set(name, data)
        }
      }
      cache.value = newCache
      loadingPackages.value = new Set()
      status.value = 'success'

      // Second pass: fetch slow install size data in background for new packages
      installSizeLoading.value = true
      Promise.all(
        namesToFetch.map(async name => {
          try {
            const installSize = await $fetch<{
              selfSize: number
              totalSize: number
              dependencyCount: number
            }>(`/api/registry/install-size/${encodePackageName(name)}`)

            // Update cache with install size
            const existing = cache.value.get(name)
            if (existing) {
              const updated = new Map(cache.value)
              updated.set(name, { ...existing, installSize })
              cache.value = updated
            }
          } catch {
            // Install size fetch failed, leave as undefined
          }
        }),
      ).finally(() => {
        installSizeLoading.value = false
      })
    } catch (e) {
      loadingPackages.value = new Set()
      error.value = e as Error
      status.value = 'error'
    }
  }

  // Watch for package changes and refetch (client-side only)
  if (import.meta.client) {
    watch(
      packages,
      newPackages => {
        fetchPackages(newPackages)
      },
      { immediate: true },
    )
  }

  // Compute values for each facet
  function getFacetValues(facet: ComparisonFacet): (FacetValue | null)[] {
    if (!packagesData.value || packagesData.value.length === 0) return []

    return packagesData.value.map(pkg => {
      if (!pkg) return null
      return computeFacetValue(
        facet,
        pkg,
        numberFormatter.value.format,
        compactNumberFormatter.value.format,
        bytesFormatter.format,
        t,
      )
    })
  }

  // Check if a facet depends on slow-loading data
  function isFacetLoading(facet: ComparisonFacet): boolean {
    if (!installSizeLoading.value) return false
    // These facets depend on install-size API
    return facet === 'installSize' || facet === 'totalDependencies'
  }

  // Check if a specific column (package) is loading
  function isColumnLoading(index: number): boolean {
    const name = packages.value[index]
    return name ? loadingPackages.value.has(name) : false
  }

  return {
    packagesData: readonly(packagesData),
    status: readonly(status),
    error: readonly(error),
    getFacetValues,
    isFacetLoading,
    isColumnLoading,
  }
}

/**
 * Creates mock data for the "What Would James Do?" comparison column.
 * This represents the baseline of having no dependency at all.
 *
 * Uses explicit display markers (NoDependencyDisplay) instead of undefined
 * to clearly indicate intentional special values vs missing data.
 */
function createNoDependencyData(): PackageComparisonData {
  return {
    package: {
      name: NO_DEPENDENCY_ID,
      version: '',
      description: undefined,
    },
    isNoDependency: true,
    downloads: undefined,
    totalLikes: undefined,
    packageSize: 0,
    directDeps: 0,
    installSize: {
      selfSize: 0,
      totalSize: 0,
      dependencyCount: 0,
    },
    analysis: undefined,
    vulnerabilities: undefined,
    metadata: {
      license: NoDependencyDisplay.DASH,
      lastUpdated: NoDependencyDisplay.UP_TO_YOU,
      engines: undefined,
      deprecated: undefined,
    },
  }
}

/**
 * Converts a special display marker to its FacetValue representation.
 */
function resolveNoDependencyDisplay(
  marker: string,
  t: (key: string) => string,
): { display: string; status: FacetValue['status'] } | null {
  switch (marker) {
    case NoDependencyDisplay.DASH:
      return { display: '–', status: 'neutral' }
    case NoDependencyDisplay.UP_TO_YOU:
      return { display: t('compare.facets.values.up_to_you'), status: 'good' }
    default:
      return null
  }
}

function computeFacetValue(
  facet: ComparisonFacet,
  data: PackageComparisonData,
  formatNumber: (num: number) => string,
  formatCompactNumber: (num: number) => string,
  formatBytes: (num: number) => string,
  t: (key: string, params?: Record<string, unknown>) => string,
): FacetValue | null {
  const { isNoDependency } = data

  switch (facet) {
    case 'downloads': {
      if (data.downloads === undefined) {
        if (isNoDependency) return { raw: 0, display: '–', status: 'neutral' }
        return null
      }
      return {
        raw: data.downloads,
        display: formatCompactNumber(data.downloads),
        status: 'neutral',
      }
    }
    case 'totalLikes': {
      if (data.totalLikes === undefined) return null
      return {
        raw: data.totalLikes,
        display: formatCompactNumber(data.totalLikes),
        status: 'neutral',
      }
    }
    case 'packageSize': {
      // A size of zero is valid
      if (data.packageSize == null) return null
      return {
        raw: data.packageSize,
        display: formatBytes(data.packageSize),
        status: data.packageSize > 5 * 1024 * 1024 ? 'warning' : 'neutral',
      }
    }
    case 'installSize': {
      // A size of zero is valid
      if (data.installSize == null) return null
      return {
        raw: data.installSize.totalSize,
        display: formatBytes(data.installSize.totalSize),
        status: data.installSize.totalSize > 50 * 1024 * 1024 ? 'warning' : 'neutral',
      }
    }
    case 'moduleFormat': {
      if (!data.analysis) {
        if (isNoDependency)
          return {
            raw: 'up-to-you',
            display: t('compare.facets.values.up_to_you'),
            status: 'good',
          }
        return null
      }
      const format = data.analysis.moduleFormat
      return {
        raw: format,
        display: format === 'dual' ? 'ESM + CJS' : format.toUpperCase(),
        status: format === 'esm' || format === 'dual' ? 'good' : 'neutral',
      }
    }
    case 'types': {
      if (data.isBinaryOnly) {
        return {
          raw: 'binary',
          display: 'N/A',
          status: 'muted',
          tooltip: t('compare.facets.binary_only_tooltip'),
        }
      }
      if (!data.analysis) {
        if (isNoDependency)
          return {
            raw: 'up-to-you',
            display: t('compare.facets.values.up_to_you'),
            status: 'good',
          }
        return null
      }
      const types = data.analysis.types
      return {
        raw: types.kind,
        display:
          types.kind === 'included'
            ? t('compare.facets.values.types_included')
            : types.kind === '@types'
              ? '@types'
              : t('compare.facets.values.types_none'),
        status: types.kind === 'included' ? 'good' : types.kind === '@types' ? 'info' : 'bad',
      }
    }
    case 'engines': {
      const engines = data.metadata?.engines
      if (!engines?.node) {
        if (isNoDependency)
          return {
            raw: 'up-to-you',
            display: t('compare.facets.values.up_to_you'),
            status: 'good',
          }
        return {
          raw: null,
          display: t('compare.facets.values.any'),
          status: 'neutral',
        }
      }
      return {
        raw: engines.node,
        display: `Node.js ${engines.node}`,
        status: 'neutral',
      }
    }
    case 'vulnerabilities': {
      if (!data.vulnerabilities) {
        if (isNoDependency)
          return {
            raw: 'up-to-you',
            display: t('compare.facets.values.up_to_you'),
            status: 'good',
          }
        return null
      }
      const count = data.vulnerabilities.count
      const sev = data.vulnerabilities.severity
      return {
        raw: count,
        display:
          count === 0
            ? t('compare.facets.values.none')
            : t('compare.facets.values.vulnerabilities_summary', {
                count,
                critical: sev.critical,
                high: sev.high,
              }),
        status: count === 0 ? 'good' : sev.critical > 0 || sev.high > 0 ? 'bad' : 'warning',
      }
    }
    case 'lastUpdated': {
      const lastUpdated = data.metadata?.lastUpdated
      const resolved = lastUpdated ? resolveNoDependencyDisplay(lastUpdated, t) : null
      if (resolved) return { raw: 0, ...resolved }
      if (!lastUpdated) return null
      const date = new Date(lastUpdated)
      return {
        raw: date.getTime(),
        display: lastUpdated,
        status: isStale(date) ? 'warning' : 'neutral',
        type: 'date',
      }
    }
    case 'license': {
      const license = data.metadata?.license
      const resolved = license ? resolveNoDependencyDisplay(license, t) : null
      if (resolved) return { raw: null, ...resolved }
      if (!license) {
        if (isNoDependency) return { raw: null, display: '–', status: 'neutral' }
        return {
          raw: null,
          display: t('compare.facets.values.unknown'),
          status: 'warning',
        }
      }
      return {
        raw: license,
        display: license,
        status: 'neutral',
      }
    }
    case 'dependencies': {
      const depCount = data.directDeps
      if (depCount == null) return null
      return {
        raw: depCount,
        display: formatNumber(depCount),
        status: depCount > 10 ? 'warning' : 'neutral',
      }
    }
    case 'deprecated': {
      const isDeprecated = !!data.metadata?.deprecated
      return {
        raw: isDeprecated,
        display: isDeprecated
          ? t('compare.facets.values.deprecated')
          : t('compare.facets.values.not_deprecated'),
        status: isDeprecated ? 'bad' : 'good',
      }
    }
    case 'totalDependencies': {
      if (!data.installSize) return null
      const totalDepCount = data.installSize.dependencyCount
      return {
        raw: totalDepCount,
        display: formatNumber(totalDepCount),
        status: totalDepCount > 50 ? 'warning' : 'neutral',
      }
    }
    default: {
      return null
    }
  }
}

function isStale(date: Date): boolean {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365)
  return diffYears > 2 // Considered stale if not updated in 2+ years
}
