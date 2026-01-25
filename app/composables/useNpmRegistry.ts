import type {
  Packument,
  PackumentVersion,
  SlimPackument,
  NpmSearchResponse,
  NpmSearchResult,
  NpmDownloadCount,
  NpmPerson,
} from '#shared/types'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_API = 'https://api.npmjs.org'

async function fetchNpmPackage(name: string): Promise<Packument> {
  const encodedName = encodePackageName(name)
  return await $fetch<Packument>(`${NPM_REGISTRY}/${encodedName}`)
}

async function searchNpmPackages(
  query: string,
  options: {
    size?: number
    from?: number
    quality?: number
    popularity?: number
    maintenance?: number
  } = {},
): Promise<NpmSearchResponse> {
  const params = new URLSearchParams()
  params.set('text', query)
  if (options.size) params.set('size', String(options.size))
  if (options.from) params.set('from', String(options.from))
  if (options.quality !== undefined) params.set('quality', String(options.quality))
  if (options.popularity !== undefined) params.set('popularity', String(options.popularity))
  if (options.maintenance !== undefined) params.set('maintenance', String(options.maintenance))

  return await $fetch<NpmSearchResponse>(`${NPM_REGISTRY}/-/v1/search?${params.toString()}`)
}

async function fetchNpmDownloads(
  packageName: string,
  period: 'last-day' | 'last-week' | 'last-month' | 'last-year' = 'last-week',
): Promise<NpmDownloadCount> {
  const encodedName = encodePackageName(packageName)
  return await $fetch<NpmDownloadCount>(`${NPM_API}/downloads/point/${period}/${encodedName}`)
}

function encodePackageName(name: string): string {
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

  // Build filtered versions object
  const filteredVersions: Record<string, PackumentVersion> = {}
  for (const v of includedVersions) {
    const version = pkg.versions[v]
    if (version) {
      // Strip readme and scripts from each version to reduce size
      const { readme: _readme, scripts: _scripts, ...slimVersion } = version
      filteredVersions[v] = slimVersion as PackumentVersion
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
  return useLazyAsyncData(
    () => `package:${toValue(name)}:${toValue(requestedVersion) ?? ''}`,
    () =>
      fetchNpmPackage(toValue(name)).then(r => transformPackument(r, toValue(requestedVersion))),
  )
}

export function usePackageDownloads(
  name: MaybeRefOrGetter<string>,
  period: MaybeRefOrGetter<'last-day' | 'last-week' | 'last-month' | 'last-year'> = 'last-week',
) {
  return useLazyAsyncData(
    () => `downloads:${toValue(name)}:${toValue(period)}`,
    () => fetchNpmDownloads(toValue(name), toValue(period)),
  )
}

type NpmDownloadsRangeResponse = {
  start: string
  end: string
  package: string
  downloads: Array<{ day: string; downloads: number }>
}

async function fetchNpmDownloadsRange(
  packageName: string,
  start: string,
  end: string,
): Promise<NpmDownloadsRangeResponse> {
  const encodedName = encodePackageName(packageName)
  return await $fetch<NpmDownloadsRangeResponse>(
    `${NPM_API}/downloads/range/${start}:${end}/${encodedName}`,
  )
}

export function usePackageWeeklyDownloadEvolution(
  name: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<{
    weeks?: number
    endDate?: string
  }> = {},
) {
  return useLazyAsyncData(
    () => `downloads-weekly-evolution:${toValue(name)}:${JSON.stringify(toValue(options))}`,
    async () => {
      const packageName = toValue(name)
      const { weeks = 12, endDate } = toValue(options) ?? {}

      const today = new Date()
      const yesterday = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
      )

      const end = endDate ? new Date(`${endDate}T00:00:00.000Z`) : yesterday

      const start = addDays(end, -(weeks * 7) + 1)
      const startIso = toIsoDateString(start)
      const endIso = toIsoDateString(end)
      const range = await fetchNpmDownloadsRange(packageName, startIso, endIso)
      const sortedDaily = [...range.downloads].sort((a, b) => a.day.localeCompare(b.day))
      return buildWeeklyEvolutionFromDaily(sortedDaily)
    },
  )
}

const emptySearchResponse = {
  objects: [],
  total: 0,
  time: new Date().toISOString(),
} satisfies NpmSearchResponse

export function useNpmSearch(
  query: MaybeRefOrGetter<string>,
  options: MaybeRefOrGetter<{
    size?: number
    from?: number
  }> = {},
) {
  let lastSearch: NpmSearchResponse | undefined = undefined

  return useLazyAsyncData(
    () => `search:${toValue(query)}:${JSON.stringify(toValue(options))}`,
    async () => {
      const q = toValue(query)
      if (!q.trim()) {
        return Promise.resolve(emptySearchResponse)
      }
      return (lastSearch = await searchNpmPackages(q, toValue(options)))
    },
    { default: () => lastSearch || emptySearchResponse },
  )
}

/**
 * Fetch all package names in an npm organization
 * Uses the /-/org/{org}/package endpoint
 */
async function fetchOrgPackageNames(orgName: string): Promise<string[]> {
  const data = await $fetch<Record<string, string>>(
    `${NPM_REGISTRY}/-/org/${encodeURIComponent(orgName)}/package`,
  )
  return Object.keys(data)
}

/**
 * Minimal packument data needed for package cards
 */
interface MinimalPackument {
  'name': string
  'description'?: string
  'dist-tags': Record<string, string>
  'time': Record<string, string>
  'maintainers'?: NpmPerson[]
}

/**
 * Fetch minimal packument data for a single package
 */
async function fetchMinimalPackument(name: string): Promise<MinimalPackument | null> {
  try {
    const encoded = encodePackageName(name)
    return await $fetch<MinimalPackument>(`${NPM_REGISTRY}/${encoded}`, {
      // Only fetch the fields we need using Accept header
      // Note: npm registry doesn't support field filtering, so we get full packument
      // but we only use what we need
    })
  } catch {
    // Package might not exist or be private
    return null
  }
}

/**
 * Convert packument to search result format for display
 */
function packumentToSearchResult(pkg: MinimalPackument): NpmSearchResult {
  const latestVersion = pkg['dist-tags'].latest || Object.values(pkg['dist-tags'])[0] || ''
  const modified = pkg.time.modified || pkg.time[latestVersion] || ''

  return {
    package: {
      name: pkg.name,
      version: latestVersion,
      description: pkg.description,
      date: pkg.time[latestVersion] || modified,
      links: {
        npm: `https://www.npmjs.com/package/${pkg.name}`,
      },
      maintainers: pkg.maintainers,
    },
    score: { final: 0, detail: { quality: 0, popularity: 0, maintenance: 0 } },
    searchScore: 0,
    updated: modified,
  }
}

/**
 * Fetch all packages for an npm organization
 * Returns search-result-like objects for compatibility with PackageList
 */
export function useOrgPackages(orgName: MaybeRefOrGetter<string>) {
  return useLazyAsyncData(
    () => `org-packages:${toValue(orgName)}`,
    async () => {
      const org = toValue(orgName)
      if (!org) {
        return emptySearchResponse
      }

      // Get all package names in the org
      const packageNames = await fetchOrgPackageNames(org)

      if (packageNames.length === 0) {
        return emptySearchResponse
      }

      // Fetch packuments in parallel (with concurrency limit)
      const concurrency = 10
      const results: NpmSearchResult[] = []

      for (let i = 0; i < packageNames.length; i += concurrency) {
        const batch = packageNames.slice(i, i + concurrency)
        const packuments = await Promise.all(batch.map(name => fetchMinimalPackument(name)))

        for (const pkg of packuments) {
          if (pkg) {
            results.push(packumentToSearchResult(pkg))
          }
        }
      }

      return {
        objects: results,
        total: results.length,
        time: new Date().toISOString(),
      } satisfies NpmSearchResponse
    },
    { default: () => emptySearchResponse },
  )
}
