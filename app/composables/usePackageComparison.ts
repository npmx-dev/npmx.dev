import type {
  FacetValue,
  ComparisonFacet,
  ComparisonPackage,
  Packument,
  VulnerabilityTreeResult,
} from '#shared/types'
import { encodePackageName } from '#shared/utils/npm'
import type { PackageAnalysisResponse } from './usePackageAnalysis'
import { isBinaryOnlyPackage } from '#shared/utils/binary-detection'

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
  /** Package's own unpacked size (from dist.unpackedSize) */
  packageSize?: number
  /** Install size data (fetched lazily) */
  installSize?: {
    selfSize: number
    totalSize: number
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
            const [downloads, analysis, vulns] = await Promise.all([
              $fetch<{ downloads: number }>(
                `https://api.npmjs.org/downloads/point/last-week/${encodePackageName(name)}`,
              ).catch(() => null),
              $fetch<PackageAnalysisResponse>(`/api/registry/analysis/${name}`).catch(() => null),
              $fetch<VulnerabilityTreeResult>(`/api/registry/vulnerabilities/${name}`).catch(
                () => null,
              ),
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
              installSize: undefined, // Will be filled in second pass
              analysis: analysis ?? undefined,
              vulnerabilities: {
                count: vulnsTotal,
                severity: vulnsSeverity,
              },
              metadata: {
                license: pkgData.license,
                // Use version-specific publish time, NOT time.modified (which can be
                // updated by metadata changes like maintainer additions)
                lastUpdated: pkgData.time?.[latestVersion],
                engines: analysis?.engines,
                deprecated: versionData?.deprecated,
              },
              isBinaryOnly: isBinary,
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
            }>(`/api/registry/install-size/${name}`)

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
      return computeFacetValue(facet, pkg, t)
    })
  }

  // Check if a facet depends on slow-loading data
  function isFacetLoading(facet: ComparisonFacet): boolean {
    if (!installSizeLoading.value) return false
    // These facets depend on install-size API
    return facet === 'installSize' || facet === 'dependencies'
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
      name: '(No Dependency)',
      version: '',
      description: 'No dependency at all! @43081j approved.',
    },
    isNoDependency: true,
    downloads: undefined,
    packageSize: 0,
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
): { display: string; status: FacetValue['status'] } | null {
  switch (marker) {
    case NoDependencyDisplay.DASH:
      return { display: '–', status: 'neutral' }
    case NoDependencyDisplay.UP_TO_YOU:
      return { display: 'Up to you!', status: 'good' }
    default:
      return null
  }
}

function computeFacetValue(
  facet: ComparisonFacet,
  data: PackageComparisonData,
  t: (key: string, params?: Record<string, unknown>) => string,
): FacetValue | null {
  const { isNoDependency } = data

  switch (facet) {
    case 'downloads':
      if (data.downloads === undefined) {
        if (isNoDependency) return { raw: 0, display: '–', status: 'neutral' }
        return null
      }
      return {
        raw: data.downloads,
        display: formatCompactNumber(data.downloads),
        status: 'neutral',
      }

    case 'packageSize':
      if (data.packageSize === undefined) return null
      return {
        raw: data.packageSize,
        display: formatBytes(data.packageSize),
        status: data.packageSize > 5 * 1024 * 1024 ? 'warning' : 'neutral',
      }

    case 'installSize':
      if (!data.installSize) return null
      return {
        raw: data.installSize.totalSize,
        display: formatBytes(data.installSize.totalSize),
        status: data.installSize.totalSize > 50 * 1024 * 1024 ? 'warning' : 'neutral',
      }

    case 'moduleFormat':
      if (!data.analysis) {
        if (isNoDependency) return { raw: 'up-to-you', display: 'Up to you!', status: 'good' }
        return null
      }
      const format = data.analysis.moduleFormat
      return {
        raw: format,
        display: format === 'dual' ? 'ESM + CJS' : format.toUpperCase(),
        status: format === 'esm' || format === 'dual' ? 'good' : 'neutral',
      }

    case 'types':
      if (data.isBinaryOnly) {
        return {
          raw: 'binary',
          display: 'N/A',
          status: 'muted',
          tooltip: t('compare.facets.binary_only_tooltip'),
        }
      }
      if (!data.analysis) {
        if (isNoDependency) return { raw: 'up-to-you', display: 'Up to you!', status: 'good' }
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

    case 'engines':
      const engines = data.metadata?.engines
      if (!engines?.node) {
        if (isNoDependency) return { raw: 'up-to-you', display: 'Up to you!', status: 'good' }
        return {
          raw: null,
          display: t('compare.facets.values.any'),
          status: 'neutral',
        }
      }
      return {
        raw: engines.node,
        display: `Node ${engines.node}`,
        status: 'neutral',
      }

    case 'vulnerabilities':
      if (!data.vulnerabilities) {
        if (isNoDependency) return { raw: 'up-to-you', display: 'Up to you!', status: 'good' }
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

    case 'lastUpdated': {
      const lastUpdated = data.metadata?.lastUpdated
      const resolved = lastUpdated ? resolveNoDependencyDisplay(lastUpdated) : null
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
      const resolved = license ? resolveNoDependencyDisplay(license) : null
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

    case 'dependencies':
      if (!data.installSize) return null
      const depCount = data.installSize.dependencyCount
      return {
        raw: depCount,
        display: String(depCount),
        status: depCount > 50 ? 'warning' : 'neutral',
      }

    case 'deprecated':
      const isDeprecated = !!data.metadata?.deprecated
      return {
        raw: isDeprecated,
        display: isDeprecated
          ? t('compare.facets.values.deprecated')
          : t('compare.facets.values.not_deprecated'),
        status: isDeprecated ? 'bad' : 'good',
      }

    // Coming soon facets
    case 'totalDependencies':
      return null

    default:
      return null
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isStale(date: Date): boolean {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffYears = diffMs / (1000 * 60 * 60 * 24 * 365)
  return diffYears > 2 // Considered stale if not updated in 2+ years
}
