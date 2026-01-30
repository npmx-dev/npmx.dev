import type { MetricValue, ComparisonFacet, ComparisonPackage } from '#shared/types'
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
 * @public
 */
export function usePackageComparison(packageNames: MaybeRefOrGetter<string[]>) {
  const packages = computed(() => toValue(packageNames))

  // Reactive state
  const packagesData = ref<(PackageComparisonData | null)[]>([])
  const status = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
  const error = ref<Error | null>(null)

  // Track install size loading separately (it's slower)
  const installSizeLoading = ref(false)

  // Track last fetched packages to avoid redundant fetches
  let lastFetchedPackages: string[] = []

  // Fetch function
  async function fetchPackages(names: string[]) {
    if (names.length === 0) {
      packagesData.value = []
      status.value = 'idle'
      lastFetchedPackages = []
      return
    }

    // Skip fetch if packages haven't actually changed
    if (
      names.length === lastFetchedPackages.length &&
      names.every((n, i) => n === lastFetchedPackages[i])
    ) {
      return
    }

    lastFetchedPackages = [...names]
    status.value = 'pending'
    error.value = null

    try {
      // First pass: fetch fast data (package info, downloads, analysis, vulns)
      const results = await Promise.all(
        names.map(async (name): Promise<PackageComparisonData | null> => {
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

      packagesData.value = results
      status.value = 'success'

      // Second pass: fetch slow install size data in background
      installSizeLoading.value = true
      Promise.all(
        names.map(async (name, index) => {
          try {
            const installSize = await $fetch<{
              selfSize: number
              totalSize: number
              dependencyCount: number
            }>(`/api/registry/install-size/${name}`)

            // Update the specific package's install size
            if (packagesData.value[index]) {
              packagesData.value[index] = {
                ...packagesData.value[index]!,
                installSize,
              }
            }
          } catch {
            // Install size fetch failed, leave as undefined
          }
        }),
      ).finally(() => {
        installSizeLoading.value = false
      })
    } catch (e) {
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

  // Compute metrics for each facet
  function getMetricValues(facet: ComparisonFacet): (MetricValue | null)[] {
    if (!packagesData.value || packagesData.value.length === 0) return []

    return packagesData.value.map(pkg => {
      if (!pkg) return null
      return computeMetricValue(facet, pkg)
    })
  }

  // Check if a facet depends on slow-loading data
  function isFacetLoading(facet: ComparisonFacet): boolean {
    if (!installSizeLoading.value) return false
    // These facets depend on install-size API
    return facet === 'installSize' || facet === 'dependencies'
  }

  return {
    packagesData: readonly(packagesData),
    status: readonly(status),
    error: readonly(error),
    getMetricValues,
    isFacetLoading,
  }
}

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

function computeMetricValue(
  facet: ComparisonFacet,
  data: PackageComparisonData,
): MetricValue | null {
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
