import type {
  Packument,
  PackumentVersion,
  SlimPackument,
  NpmSearchResponse,
  NpmSearchResult,
  NpmDownloadCount,
  NpmPerson,
  PackageVersionInfo,
} from '#shared/types'
import type { ReleaseType } from 'semver'
import { maxSatisfying, prerelease, major, minor, diff, gt, compare } from 'semver'
import { isExactVersion } from '~/utils/versions'
import { extractInstallScriptsInfo } from '~/utils/install-scripts'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_API = 'https://api.npmjs.org'

// Cache for packument fetches to avoid duplicate requests across components
const packumentCache = new Map<string, Promise<Packument | null>>()

/**
 * Fetch downloads for multiple packages.
 * Returns a map of package name -> weekly downloads.
 * Uses bulk API for unscoped packages, parallel individual requests for scoped.
 * Note: npm bulk downloads API does not support scoped packages.
 */
async function fetchBulkDownloads(
  packageNames: string[],
  options: Parameters<typeof $fetch>[1] = {},
): Promise<Map<string, number>> {
  const downloads = new Map<string, number>()
  if (packageNames.length === 0) return downloads

  // Separate scoped and unscoped packages
  const scopedPackages = packageNames.filter(n => n.startsWith('@'))
  const unscopedPackages = packageNames.filter(n => !n.startsWith('@'))

  // Fetch unscoped packages via bulk API (max 128 per request)
  const bulkPromises: Promise<void>[] = []
  const chunkSize = 100
  for (let i = 0; i < unscopedPackages.length; i += chunkSize) {
    const chunk = unscopedPackages.slice(i, i + chunkSize)
    bulkPromises.push(
      (async () => {
        try {
          const response = await $fetch<Record<string, { downloads: number } | null>>(
            `${NPM_API}/downloads/point/last-week/${chunk.join(',')}`,
            options,
          )
          for (const [name, data] of Object.entries(response)) {
            if (data?.downloads !== undefined) {
              downloads.set(name, data.downloads)
            }
          }
        } catch {
          // Ignore errors - downloads are optional
        }
      })(),
    )
  }

  // Fetch scoped packages in parallel batches (concurrency limit to avoid overwhelming the API)
  // Use Promise.allSettled to not fail on individual errors
  const scopedBatchSize = 20 // Concurrent requests per batch
  for (let i = 0; i < scopedPackages.length; i += scopedBatchSize) {
    const batch = scopedPackages.slice(i, i + scopedBatchSize)
    bulkPromises.push(
      (async () => {
        const results = await Promise.allSettled(
          batch.map(async name => {
            const encoded = encodePackageName(name)
            const data = await $fetch<{ downloads: number }>(
              `${NPM_API}/downloads/point/last-week/${encoded}`,
            )
            return { name, downloads: data.downloads }
          }),
        )
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.downloads !== undefined) {
            downloads.set(result.value.name, result.value.downloads)
          }
        }
      })(),
    )
  }

  // Wait for all fetches to complete
  await Promise.all(bulkPromises)

  return downloads
}

/**
 * Encode a package name for use in npm registry URLs.
 * Handles scoped packages (e.g., @scope/name -> @scope%2Fname).
 */
export function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

/** Number of recent versions to include in initial payload */
const RECENT_VERSIONS_COUNT = 5

/**
 * Transform a full Packument into a slimmed version for client-side use.
 * Reduces payload size by:
 * - Removing readme (fetched separately)
 * - Including only: 5 most recent versions + one version per dist-tag + requested version
 * - Stripping unnecessary fields from version objects
 */
function transformPackument(pkg: Packument, requestedVersion?: string | null): SlimPackument {
  // Get versions pointed to by dist-tags
  const distTagVersions = new Set(Object.values(pkg['dist-tags'] ?? {}))

  // Get 5 most recent versions by publish time
  const recentVersions = Object.keys(pkg.versions)
    .filter(v => pkg.time[v])
    .sort((a, b) => {
      const timeA = pkg.time[a]
      const timeB = pkg.time[b]
      if (!timeA || !timeB) return 0
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
    .slice(0, RECENT_VERSIONS_COUNT)

  // Combine: recent versions + dist-tag versions + requested version (deduplicated)
  const includedVersions = new Set([...recentVersions, ...distTagVersions])

  // Add the requested version if it exists in the package
  if (requestedVersion && pkg.versions[requestedVersion]) {
    includedVersions.add(requestedVersion)
  }

  // Build filtered versions object with install scripts info per version
  const filteredVersions: Record<string, PackumentVersion> = {}
  for (const v of includedVersions) {
    const version = pkg.versions[v]
    if (version) {
      // Strip readme from each version, extract install scripts info
      const { readme: _readme, scripts, ...slimVersion } = version

      // Extract install scripts info (which scripts exist + npx deps)
      const installScripts = scripts ? extractInstallScriptsInfo(scripts) : null

      filteredVersions[v] = {
        ...slimVersion,
        installScripts: installScripts ?? undefined,
      } as PackumentVersion
    }
  }

  // Build filtered time object (only for included versions + metadata)
  const filteredTime: Record<string, string> = {}
  if (pkg.time.modified) filteredTime.modified = pkg.time.modified
  if (pkg.time.created) filteredTime.created = pkg.time.created
  for (const v of includedVersions) {
    if (pkg.time[v]) filteredTime[v] = pkg.time[v]
  }

  return {
    '_id': pkg._id,
    '_rev': pkg._rev,
    'name': pkg.name,
    'description': pkg.description,
    'dist-tags': pkg['dist-tags'],
    'time': filteredTime,
    'maintainers': pkg.maintainers,
    'author': pkg.author,
    'license': pkg.license,
    'homepage': pkg.homepage,
    'keywords': pkg.keywords,
    'repository': pkg.repository,
    'bugs': pkg.bugs,
    'versions': filteredVersions,
  }
}

export function usePackage(
  name: MaybeRefOrGetter<string>,
  requestedVersion?: MaybeRefOrGetter<string | null>,
) {
  const cachedFetch = useCachedFetch()

  const asyncData = useLazyAsyncData(
    () => `package:${toValue(name)}:${toValue(requestedVersion) ?? ''}`,
    async (_nuxtApp, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const { data: r, isStale } = await cachedFetch<Packument>(`${NPM_REGISTRY}/${encodedName}`, {
        signal,
      })
      const reqVer = toValue(requestedVersion)
      const pkg = transformPackument(r, reqVer)
      const resolvedVersion = getResolvedVersion(pkg, reqVer)
      return { ...pkg, resolvedVersion, isStale }
    },
  )

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return asyncData
}

function getResolvedVersion(pkg: SlimPackument, reqVer?: string | null): string | null {
  if (!pkg || !reqVer) return null

  // 1. Check if it's already an exact version in pkg.versions
  if (isExactVersion(reqVer) && pkg.versions[reqVer]) {
    return reqVer
  }

  // 2. Check if it's a dist-tag (latest, next, beta, etc.)
  const tagVersion = pkg['dist-tags']?.[reqVer]
  if (tagVersion) {
    return tagVersion
  }

  // 3. Try to resolve as a semver range
  const versions = Object.keys(pkg.versions)
  const resolved = maxSatisfying(versions, reqVer)
  return resolved
}

export function usePackageDownloads(
  name: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<'last-day' | 'last-week' | 'last-month' | 'last-year'> = 'last-week',
) {
  const cachedFetch = useCachedFetch()

  const asyncData = useLazyAsyncData(
    () => `downloads:${toValue(name)}:${toValue(period)}`,
    async (_nuxtApp, { signal }) => {
      const encodedName = encodePackageName(toValue(name))
      const { data, isStale } = await cachedFetch<NpmDownloadCount>(
        `${NPM_API}/downloads/point/${toValue(period)}/${encodedName}`,
        { signal },
      )
      return { ...data, isStale }
    },
  )

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  return asyncData
}

type NpmDownloadsRangeResponse = {
  start: string
  end: string
  package: string
  downloads: Array<{ day: string; downloads: number }>
}

/**
 * Fetch download range data from npm API.
 * Exported for external use (e.g., in components).
 */
export async function fetchNpmDownloadsRange(
  packageName: string,
  start: string,
  end: string,
): Promise<NpmDownloadsRangeResponse> {
  const encodedName = encodePackageName(packageName)
  return await $fetch<NpmDownloadsRangeResponse>(
    `${NPM_API}/downloads/range/${start}:${end}/${encodedName}`,
  )
}

const emptySearchResponse = {
  objects: [],
  total: 0,
  isStale: false,
  time: new Date().toISOString(),
} satisfies NpmSearchResponse

export interface NpmSearchOptions {
  /** Number of results to fetch */
  size?: number
}

export function useNpmSearch(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<NpmSearchOptions> = {},
) {
  const cachedFetch = useCachedFetch()
  // Client-side cache
  const cache = shallowRef<{
    query: string
    objects: NpmSearchResult[]
    total: number
  } | null>(null)

  const isLoadingMore = shallowRef(false)

  // Standard (non-incremental) search implementation
  let lastSearch: NpmSearchResponse | undefined = undefined

  const asyncData = useLazyAsyncData(
    () => `search:incremental:${toValue(query)}`,
    async (_nuxtApp, { signal }) => {
      const q = toValue(query)
      if (!q.trim()) {
        return emptySearchResponse
      }

      const opts = toValue(options)

      // This only runs for initial load or query changes
      // Reset cache for new query
      cache.value = null

      const params = new URLSearchParams()
      params.set('text', q)
      // Use requested size for initial fetch
      params.set('size', String(opts.size ?? 25))

      const { data: response, isStale } = await cachedFetch<NpmSearchResponse>(
        `${NPM_REGISTRY}/-/v1/search?${params.toString()}`,
        { signal },
        60,
      )

      cache.value = {
        query: q,
        objects: response.objects,
        total: response.total,
      }

      return { ...response, isStale }
    },
    { default: () => lastSearch || emptySearchResponse },
  )

  // Fetch more results incrementally (only used in incremental mode)
  async function fetchMore(targetSize: number): Promise<void> {
    const q = toValue(query).trim()
    if (!q) {
      cache.value = null
      return
    }

    // If query changed, reset cache (shouldn't happen, but safety check)
    if (cache.value && cache.value.query !== q) {
      cache.value = null
      await asyncData.refresh()
      return
    }

    const currentCount = cache.value?.objects.length ?? 0
    const total = cache.value?.total ?? Infinity

    // Already have enough or no more to fetch
    if (currentCount >= targetSize || currentCount >= total) {
      return
    }

    isLoadingMore.value = true

    try {
      // Fetch from where we left off - calculate size needed
      const from = currentCount
      const size = Math.min(targetSize - currentCount, total - currentCount)

      const params = new URLSearchParams()
      params.set('text', q)
      params.set('size', String(size))
      params.set('from', String(from))

      const { data: response } = await cachedFetch<NpmSearchResponse>(
        `${NPM_REGISTRY}/-/v1/search?${params.toString()}`,
        {},
        60,
      )

      // Update cache
      if (cache.value && cache.value.query === q) {
        const existingNames = new Set(cache.value.objects.map(obj => obj.package.name))
        const newObjects = response.objects.filter(obj => !existingNames.has(obj.package.name))
        cache.value = {
          query: q,
          objects: [...cache.value.objects, ...newObjects],
          total: response.total,
        }
      } else {
        cache.value = {
          query: q,
          objects: response.objects,
          total: response.total,
        }
      }

      // If we still need more, fetch again recursively
      if (
        cache.value.objects.length < targetSize &&
        cache.value.objects.length < cache.value.total
      ) {
        await fetchMore(targetSize)
      }
    } finally {
      isLoadingMore.value = false
    }
  }

  // Watch for size increases in incremental mode
  watch(
    () => toValue(options).size,
    async (newSize, oldSize) => {
      if (!newSize) return
      if (oldSize && newSize > oldSize && toValue(query).trim()) {
        await fetchMore(newSize)
      }
    },
  )

  // Computed data that uses cache in incremental mode
  const data = computed<NpmSearchResponse | null>(() => {
    if (cache.value) {
      return {
        isStale: false,
        objects: cache.value.objects,
        total: cache.value.total,
        time: new Date().toISOString(),
      }
    }
    return asyncData.data.value
  })

  if (import.meta.client && asyncData.data.value?.isStale) {
    onMounted(() => {
      asyncData.refresh()
    })
  }

  // Whether there are more results available on the server (incremental mode only)
  const hasMore = computed(() => {
    if (!cache.value) return true
    return cache.value.objects.length < cache.value.total
  })

  return {
    ...asyncData,
    /** Reactive search results (uses cache in incremental mode) */
    data,
    /** Whether currently loading more results (incremental mode only) */
    isLoadingMore,
    /** Whether there are more results available (incremental mode only) */
    hasMore,
    /** Manually fetch more results up to target size (incremental mode only) */
    fetchMore,
  }
}

/**
 * Minimal packument data needed for package cards
 */
interface MinimalPackument {
  'name': string
  'description'?: string
  'keywords'?: string[]
  // `dist-tags` can be missing in some later unpublished packages
  'dist-tags'?: Record<string, string>
  'time': Record<string, string>
  'maintainers'?: NpmPerson[]
}

/**
 * Convert packument to search result format for display
 */
function packumentToSearchResult(pkg: MinimalPackument, weeklyDownloads?: number): NpmSearchResult {
  let latestVersion = ''
  if (pkg['dist-tags']) {
    latestVersion = pkg['dist-tags'].latest || Object.values(pkg['dist-tags'])[0] || ''
  }
  const modified = pkg.time.modified || pkg.time[latestVersion] || ''

  return {
    package: {
      name: pkg.name,
      version: latestVersion,
      description: pkg.description,
      keywords: pkg.keywords,
      date: pkg.time[latestVersion] || modified,
      links: {
        npm: `https://www.npmjs.com/package/${pkg.name}`,
      },
      maintainers: pkg.maintainers,
    },
    score: { final: 0, detail: { quality: 0, popularity: 0, maintenance: 0 } },
    searchScore: 0,
    downloads: weeklyDownloads !== undefined ? { weekly: weeklyDownloads } : undefined,
    updated: pkg.time[latestVersion] || modified,
  }
}

/**
 * Fetch all packages for an npm organization
 * Returns search-result-like objects for compatibility with PackageList
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  const cachedFetch = useCachedFetch()

  const asyncData = useLazyAsyncData(
    () => `org-packages:${toValue(orgName)}`,
    async (_nuxtApp, { signal }) => {
      const org = toValue(orgName)
      if (!org) {
        return emptySearchResponse
      }

      // Get all package names in the org
      let packageNames: string[]
      try {
        const { data } = await cachedFetch<Record<string, string>>(
          `${NPM_REGISTRY}/-/org/${encodeURIComponent(org)}/package`,
          { signal },
        )
        packageNames = Object.keys(data)
      } catch (err) {
        // Check if this is a 404 (org not found)
        if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404) {
          throw createError({
            statusCode: 404,
            statusMessage: 'Organization not found',
            message: `The organization "@${org}" does not exist on npm`,
          })
        }
        // For other errors (network, etc.), return empty array to be safe
        packageNames = []
      }

      if (packageNames.length === 0) {
        return emptySearchResponse
      }

      // Fetch packuments and downloads in parallel
      const [packuments, downloads] = await Promise.all([
        // Fetch packuments in parallel (with concurrency limit)
        (async () => {
          const concurrency = 10
          const results: MinimalPackument[] = []
          for (let i = 0; i < packageNames.length; i += concurrency) {
            const batch = packageNames.slice(i, i + concurrency)
            const batchResults = await Promise.all(
              batch.map(async name => {
                try {
                  const encoded = encodePackageName(name)
                  const { data: pkg } = await cachedFetch<MinimalPackument>(
                    `${NPM_REGISTRY}/${encoded}`,
                    { signal },
                  )
                  return pkg
                } catch {
                  return null
                }
              }),
            )
            for (const pkg of batchResults) {
              // Filter out any unpublished packages (missing dist-tags)
              if (pkg && pkg['dist-tags']) {
                results.push(pkg)
              }
            }
          }
          return results
        })(),
        // Fetch downloads in bulk
        fetchBulkDownloads(packageNames, { signal }),
      ])

      // Convert to search results with download data
      const results: NpmSearchResult[] = packuments.map(pkg =>
        packumentToSearchResult(pkg, downloads.get(pkg.name)),
      )

      return {
        isStale: false,
        objects: results,
        total: results.length,
        time: new Date().toISOString(),
      } satisfies NpmSearchResponse
    },
    { default: () => emptySearchResponse },
  )

  return asyncData
}

// ============================================================================
// Package Versions
// ============================================================================

// Cache for full version lists (client-side only, for non-composable usage)
const allVersionsCache = new Map<string, Promise<PackageVersionInfo[]>>()

/**
 * Fetch all versions of a package from the npm registry.
 * Returns version info sorted by version (newest first).
 * Results are cached to avoid duplicate requests.
 *
 * Note: This is a standalone async function for use in event handlers.
 * For composable usage, use useAllPackageVersions instead.
 */
export async function fetchAllPackageVersions(packageName: string): Promise<PackageVersionInfo[]> {
  const cached = allVersionsCache.get(packageName)
  if (cached) return cached

  const promise = (async () => {
    const encodedName = encodePackageName(packageName)
    // Use regular $fetch for client-side calls (this is called on user interaction)
    const data = await $fetch<{
      versions: Record<string, { deprecated?: string }>
      time: Record<string, string>
    }>(`${NPM_REGISTRY}/${encodedName}`)

    return Object.entries(data.versions)
      .filter(([v]) => data.time[v])
      .map(([version, versionData]) => ({
        version,
        time: data.time[version],
        hasProvenance: false, // Would need to check dist.attestations for each version
        deprecated: versionData.deprecated,
      }))
      .sort((a, b) => compare(b.version, a.version))
  })()

  allVersionsCache.set(packageName, promise)
  return promise
}

// ============================================================================
// Outdated Dependencies
// ============================================================================

/** Information about an outdated dependency */
export interface OutdatedDependencyInfo {
  /** The resolved version that satisfies the constraint */
  resolved: string
  /** The latest available version */
  latest: string
  /** How many major versions behind */
  majorsBehind: number
  /** How many minor versions behind (when same major) */
  minorsBehind: number
  /** The type of version difference */
  diffType: ReleaseType | null
}

/**
 * Check if a version constraint explicitly includes a prerelease tag.
 * e.g., "^1.0.0-alpha" or ">=2.0.0-beta.1" include prereleases
 */
export function constraintIncludesPrerelease(constraint: string): boolean {
  return (
    /-(alpha|beta|rc|next|canary|dev|preview|pre|experimental)/i.test(constraint) ||
    /-\d/.test(constraint)
  )
}

/**
 * Check if a constraint is a non-semver value (git URL, file path, etc.)
 */
export function isNonSemverConstraint(constraint: string): boolean {
  return (
    constraint.startsWith('git') ||
    constraint.startsWith('http') ||
    constraint.startsWith('file:') ||
    constraint.startsWith('npm:') ||
    constraint.startsWith('link:') ||
    constraint.startsWith('workspace:') ||
    constraint.includes('/')
  )
}

/**
 * Check if a dependency is outdated.
 * Returns null if up-to-date or if we can't determine.
 */
async function checkDependencyOutdated(
  cachedFetch: CachedFetchFunction,
  packageName: string,
  constraint: string,
): Promise<OutdatedDependencyInfo | null> {
  if (isNonSemverConstraint(constraint)) {
    return null
  }

  // Check in-memory cache first
  let packument: Packument | null
  const cached = packumentCache.get(packageName)
  if (cached) {
    packument = await cached
  } else {
    const promise = cachedFetch<Packument>(`${NPM_REGISTRY}/${encodePackageName(packageName)}`)
      .then(({ data }) => data)
      .catch(() => null)
    packumentCache.set(packageName, promise)
    packument = await promise
  }

  if (!packument) return null

  const latestTag = packument['dist-tags']?.latest
  if (!latestTag) return null

  // Handle "latest" constraint specially - return info with current version
  if (constraint === 'latest') {
    return {
      resolved: latestTag,
      latest: latestTag,
      majorsBehind: 0,
      minorsBehind: 0,
      diffType: null,
    }
  }

  let versions = Object.keys(packument.versions)
  const includesPrerelease = constraintIncludesPrerelease(constraint)

  if (!includesPrerelease) {
    versions = versions.filter(v => !prerelease(v))
  }

  const resolved = maxSatisfying(versions, constraint)
  if (!resolved) return null

  if (resolved === latestTag) return null

  // If resolved version is newer than latest, not outdated
  // (e.g., using ^2.0.0-rc when latest is 1.x)
  if (gt(resolved, latestTag)) {
    return null
  }

  const diffType = diff(resolved, latestTag)
  const majorsBehind = major(latestTag) - major(resolved)
  const minorsBehind = majorsBehind === 0 ? minor(latestTag) - minor(resolved) : 0

  return {
    resolved,
    latest: latestTag,
    majorsBehind,
    minorsBehind,
    diffType,
  }
}

/**
 * Composable to check for outdated dependencies.
 * Returns a reactive map of dependency name to outdated info.
 */
export function useOutdatedDependencies(
  dependencies: MaybeRefOrGetter<Record<string, string> | undefined>,
) {
  const cachedFetch = useCachedFetch()
  const outdated = shallowRef<Record<string, OutdatedDependencyInfo>>({})

  async function fetchOutdatedInfo(deps: Record<string, string> | undefined) {
    if (!deps || Object.keys(deps).length === 0) {
      outdated.value = {}
      return
    }

    const results: Record<string, OutdatedDependencyInfo> = {}
    const entries = Object.entries(deps)
    const batchSize = 5

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async ([name, constraint]) => {
          const info = await checkDependencyOutdated(cachedFetch, name, constraint)
          return [name, info] as const
        }),
      )

      for (const [name, info] of batchResults) {
        if (info) {
          results[name] = info
        }
      }
    }

    outdated.value = results
  }

  watch(
    () => toValue(dependencies),
    deps => {
      fetchOutdatedInfo(deps)
    },
    { immediate: true },
  )

  return outdated
}

/**
 * Get tooltip text for an outdated dependency
 */
export function getOutdatedTooltip(
  info: OutdatedDependencyInfo,
  t: (key: string, params?: Record<string, unknown>, plural?: number) => string,
): string {
  if (info.majorsBehind > 0) {
    return t(
      'package.dependencies.outdated_major',
      { count: info.majorsBehind, latest: info.latest },
      info.majorsBehind,
    )
  }
  if (info.minorsBehind > 0) {
    return t(
      'package.dependencies.outdated_minor',
      { count: info.minorsBehind, latest: info.latest },
      info.minorsBehind,
    )
  }
  return t('package.dependencies.outdated_patch', { latest: info.latest })
}

/**
 * Get CSS class for a dependency version based on outdated status
 */
export function getVersionClass(info: OutdatedDependencyInfo | undefined): string {
  if (!info) return 'text-fg-subtle'
  // Green for up-to-date (e.g. "latest" constraint)
  if (info.majorsBehind === 0 && info.minorsBehind === 0 && info.resolved === info.latest) {
    return 'text-green-500 cursor-help'
  }
  // Red for major versions behind
  if (info.majorsBehind > 0) return 'text-red-500 cursor-help'
  // Orange for minor versions behind
  if (info.minorsBehind > 0) return 'text-orange-500 cursor-help'
  // Yellow for patch versions behind
  return 'text-yellow-500 cursor-help'
}
