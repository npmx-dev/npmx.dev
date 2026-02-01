import type { FacetValue, ComparisonFacet, ComparisonPackage } from '#shared/types'
import type { PackageAnalysisResponse } from './usePackageAnalysis'

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
    severity: { critical: number; high: number; medium: number; low: number }
  }
  metadata?: {
    license?: string
    lastUpdated?: string
    engines?: { node?: string; npm?: string }
    deprecated?: string
  }
}

/**
 * Composable for fetching and comparing multiple packages.
 *
 */
export function usePackageComparison(packageNames: MaybeRefOrGetter<string[]>) {
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

    // Only fetch packages not already cached
    const namesToFetch = names.filter(name => !cache.value.has(name))

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
            const pkgData = await $fetch<{
              'name': string
              'dist-tags': Record<string, string>
              'time': Record<string, string>
              'license'?: string
              'versions': Record<string, { dist?: { unpackedSize?: number }; deprecated?: string }>
            }>(`https://registry.npmjs.org/${encodePackageName(name)}`)

            const latestVersion = pkgData['dist-tags']?.latest
            if (!latestVersion) return null

            // Fetch fast additional data in parallel (optional - failures are ok)
            const [downloads, analysis, vulns] = await Promise.all([
              $fetch<{ downloads: number }>(
                `https://api.npmjs.org/downloads/point/last-week/${encodePackageName(name)}`,
              ).catch(() => null),
              $fetch<PackageAnalysisResponse>(`/api/registry/analysis/${name}`).catch(() => null),
              $fetch<{
                vulnerabilities: Array<{ severity: string }>
              }>(`/api/registry/vulnerabilities/${name}`).catch(() => null),
            ])

            const versionData = pkgData.versions[latestVersion]
            const packageSize = versionData?.dist?.unpackedSize

            // Count vulnerabilities by severity
            const vulnCounts = { critical: 0, high: 0, medium: 0, low: 0 }
            const vulnList = vulns?.vulnerabilities ?? []
            for (const v of vulnList) {
              const sev = v.severity.toLowerCase() as keyof typeof vulnCounts
              if (sev in vulnCounts) vulnCounts[sev]++
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
                count: vulnList.length,
                severity: vulnCounts,
              },
              metadata: {
                license: pkgData.license,
                lastUpdated: pkgData.time?.modified,
                engines: analysis?.engines,
                deprecated: versionData?.deprecated,
              },
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
      return computeFacetValue(facet, pkg)
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

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

function computeFacetValue(facet: ComparisonFacet, data: PackageComparisonData): FacetValue | null {
  switch (facet) {
    case 'downloads':
      if (data.downloads === undefined) return null
      return {
        raw: data.downloads,
        display: formatCompactNumber(data.downloads),
        status: 'neutral',
      }

    case 'packageSize':
      if (!data.packageSize) return null
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
      if (!data.analysis) return null
      const format = data.analysis.moduleFormat
      return {
        raw: format,
        display: format === 'dual' ? 'ESM + CJS' : format.toUpperCase(),
        status: format === 'esm' || format === 'dual' ? 'good' : 'neutral',
      }

    case 'types':
      if (!data.analysis) return null
      const types = data.analysis.types
      return {
        raw: types.kind,
        display:
          types.kind === 'included' ? 'Included' : types.kind === '@types' ? '@types' : 'None',
        status: types.kind === 'included' ? 'good' : types.kind === '@types' ? 'info' : 'bad',
      }

    case 'engines':
      const engines = data.metadata?.engines
      if (!engines?.node) return { raw: null, display: 'Any', status: 'neutral' }
      return {
        raw: engines.node,
        display: `Node ${engines.node}`,
        status: 'neutral',
      }

    case 'vulnerabilities':
      if (!data.vulnerabilities) return null
      const count = data.vulnerabilities.count
      const sev = data.vulnerabilities.severity
      return {
        raw: count,
        display: count === 0 ? 'None' : `${count} (${sev.critical}C/${sev.high}H)`,
        status: count === 0 ? 'good' : sev.critical > 0 || sev.high > 0 ? 'bad' : 'warning',
      }

    case 'lastUpdated':
      if (!data.metadata?.lastUpdated) return null
      const date = new Date(data.metadata.lastUpdated)
      return {
        raw: date.getTime(),
        display: data.metadata.lastUpdated,
        status: isStale(date) ? 'warning' : 'neutral',
        type: 'date',
      }

    case 'license':
      const license = data.metadata?.license
      if (!license) return { raw: null, display: 'Unknown', status: 'warning' }
      return {
        raw: license,
        display: license,
        status: 'neutral',
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
        display: isDeprecated ? 'Deprecated' : 'No',
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
