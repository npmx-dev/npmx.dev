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
import {
  liteClient as algoliasearch,
  type LiteClient,
  type SearchResponse,
} from 'algoliasearch/lite'
import type { ReleaseType } from 'semver'
import { maxSatisfying, prerelease, major, minor, diff, gt, compare } from 'semver'
import { isExactVersion } from '~/utils/versions'
import { extractInstallScriptsInfo } from '~/utils/install-scripts'

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_API = 'https://api.npmjs.org'

// Cache for packument fetches to avoid duplicate requests across components
const packumentCache = new Map<string, Promise<Packument | null>>()

/**
 * Fetch a package's full packument data.
 * Uses caching to avoid duplicate requests.
 */
async function fetchNpmPackage(name: string): Promise<Packument> {
  const encodedName = encodePackageName(name)
  return await $fetch<Packument>(`${NPM_REGISTRY}/${encodedName}`)
}

/**
 * Fetch a package's packument with caching (returns null on error).
 * This is useful for batch operations where some packages might not exist.
 */
async function fetchCachedPackument(name: string): Promise<Packument | null> {
  const cached = packumentCache.get(name)
  if (cached) return cached

  const promise = fetchNpmPackage(name).catch(() => null)
  packumentCache.set(name, promise)
  return promise
}

const ALGOLIA_SEARCH = true
let searchClient: LiteClient
if (ALGOLIA_SEARCH) {
  searchClient = algoliasearch('OFCNCOG2CU', 'f54e21fa3a2a0160595bb058179bfb1e')
}

type SearchOptions = {
  size?: number
  from?: number
  quality?: number
  popularity?: number
  maintenance?: number
}

interface Owner {
  name: string
  email?: string
  avatar?: string
  link?: string
}

interface Repo {
  url: string
  host: string
  user: string
  project: string
  path: string
  head?: string
  branch?: string
}

interface GithubRepo {
  user: string
  project: string
  path: string
  head: string
}

type TsType =
  | {
      ts: 'definitely-typed'
      definitelyTyped: string
    }
  | {
      ts: 'included' | false | { possible: true }
    }

type ModuleType = 'cjs' | 'esm' | 'none' | 'unknown'

type StyleType = string | 'none'

type ComputedMeta = {
  computedKeywords: string[]
  computedMetadata: Record<string, unknown>
}

type GetUser = {
  name: string
  email?: string
}

type AlgoliaSearchResult = {
  objectID: string
  rev: string
  name: string
  downloadsLast30Days: number
  downloadsRatio: number
  humanDownloadsLast30Days: string
  jsDelivrHits: number
  popular: boolean
  version: string
  versions: Record<string, string>
  tags: Record<string, string>
  description: string | null
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  originalAuthor?: GetUser
  repository: Repo | null
  githubRepo: GithubRepo | null
  gitHead: string | null
  readme: string
  owner: Owner | null
  deprecated: boolean | string
  isDeprecated: boolean
  deprecatedReason: string | null
  isSecurityHeld: boolean
  homepage: string | null
  license: string | null
  keywords: string[]
  computedKeywords: ComputedMeta['computedKeywords']
  computedMetadata: ComputedMeta['computedMetadata']
  created: number
  modified: number
  lastPublisher: Owner | null
  owners: Owner[]
  bin: Record<string, string>
  dependents: number
  types: TsType
  moduleTypes: ModuleType[]
  styleTypes: StyleType[]
  humanDependents: string
  changelogFilename: string | null
  lastCrawl: string
  _revision: number
  _searchInternal: {
    alternativeNames: string[]
    popularAlternativeNames: string[]
  }
}

async function searchNpmPackages(
  query: string,
  options: SearchOptions = {},
): Promise<NpmSearchResponse> {
  if (ALGOLIA_SEARCH) {
    return searchClient
      .search([
        {
          indexName: 'npm-search',
          params: {
            query,
            offset: options.from,
            length: options.size,
            filters: '',
            analyticsTags: ['npmx.dev'],
            attributesToRetrieve: [
              'name',
              'version',
              'description',
              'modified',
              'homepage',
              'repository',
              'owners',
              'downloadsRatio',
              'popular',
            ],
            // TODO: actually use this in PackageCard, but requires the splitting and re-joining logic as in InstantSearch and conditional based on ALGOLIA boolean
            attributesToHighlight: ['name', 'description'],
          },
        },
      ])
      .then(({ results }) => {
        const response = results[0] as SearchResponse<AlgoliaSearchResult>
        return {
          objects: response.hits.map<NpmSearchResult>(hit => ({
            package: {
              name: hit.name,
              version: hit.version,
              description: hit.description || '',
              date: new Date(hit.modified).toISOString(),
              links: {
                npm: `https://www.npmjs.com/package/${hit.name}`,
                homepage: hit.homepage || undefined,
                repository: hit.repository?.url || undefined,
              },
              maintainers: hit.owners
                ? hit.owners.map(owner => ({
                    name: owner.name,
                    email: owner.email,
                  }))
                : [],
            },
            score: {
              final: 0,
              detail: {
                quality: hit.popular ? 1 : 0,
                popularity: hit.downloadsRatio,
                maintenance: 0,
              },
            },
            searchScore: 0,
            updated: new Date(hit.modified).toISOString(),
          })),
          total: response.nbHits!,
          time: new Date().toISOString(),
        }
      })
  }
  return await searchNpmPackagesViaRegistry(query, options)
}

async function searchNpmPackagesViaRegistry(
  query: string,
  options: SearchOptions,
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
  const asyncData = useLazyAsyncData(
    () => `package:${toValue(name)}:${toValue(requestedVersion) ?? ''}`,
    () =>
      fetchNpmPackage(toValue(name)).then(r => transformPackument(r, toValue(requestedVersion))),
  )

  // Resolve requestedVersion to an exact version
  // Handles: exact versions, dist-tags (latest, next), and semver ranges (^4.2, >=1.0.0)
  const resolvedVersion = computed(() => {
    const pkg = asyncData.data.value
    const reqVer = toValue(requestedVersion)
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
  })

  return {
    ...asyncData,
    resolvedVersion,
  }
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
 * Throws error with statusCode 404 if org doesn't exist
 * Returns empty array if org exists but has no packages
 */
async function fetchOrgPackageNames(orgName: string): Promise<string[]> {
  try {
    const data = await $fetch<Record<string, string>>(
      `${NPM_REGISTRY}/-/org/${encodeURIComponent(orgName)}/package`,
    )
    return Object.keys(data)
  } catch (err) {
    // Check if this is a 404 (org not found)
    if (err && typeof err === 'object' && 'statusCode' in err && err.statusCode === 404) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Organization not found',
        message: `The organization "@${orgName}" does not exist on npm`,
      })
    }
    // For other errors (network, etc.), return empty array to be safe
    return []
  }
}

/**
 * Minimal packument data needed for package cards
 */
interface MinimalPackument {
  'name': string
  'description'?: string
  // `dist-tags` can be missing in some later unpublished packages
  'dist-tags'?: Record<string, string>
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
          // Filter out any unpublished packages (missing dist-tags)
          if (pkg && pkg['dist-tags']) {
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

// ============================================================================
// Package Versions
// ============================================================================

// Cache for full version lists
const allVersionsCache = new Map<string, Promise<PackageVersionInfo[]>>()

/**
 * Fetch all versions of a package from the npm registry.
 * Returns version info sorted by version (newest first).
 * Results are cached to avoid duplicate requests.
 */
export async function fetchAllPackageVersions(packageName: string): Promise<PackageVersionInfo[]> {
  const cached = allVersionsCache.get(packageName)
  if (cached) return cached

  const promise = (async () => {
    const encodedName = encodePackageName(packageName)
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
function constraintIncludesPrerelease(constraint: string): boolean {
  return (
    /-(alpha|beta|rc|next|canary|dev|preview|pre|experimental)/i.test(constraint) ||
    /-\d/.test(constraint)
  )
}

/**
 * Check if a constraint is a non-semver value (git URL, file path, etc.)
 */
function isNonSemverConstraint(constraint: string): boolean {
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
 *
 * A dependency is only considered "outdated" if the resolved version
 * is older than the latest version. If the resolved version is newer
 * (e.g., using ^2.0.0-rc when latest is 1.x), it's not outdated.
 */
async function checkDependencyOutdated(
  packageName: string,
  constraint: string,
): Promise<OutdatedDependencyInfo | null> {
  if (isNonSemverConstraint(constraint)) {
    return null
  }

  const packument = await fetchCachedPackument(packageName)
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
          const info = await checkDependencyOutdated(name, constraint)
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
export function getOutdatedTooltip(info: OutdatedDependencyInfo): string {
  if (info.majorsBehind > 0) {
    const s = info.majorsBehind === 1 ? '' : 's'
    return `${info.majorsBehind} major version${s} behind (latest: ${info.latest})`
  }
  if (info.minorsBehind > 0) {
    const s = info.minorsBehind === 1 ? '' : 's'
    return `${info.minorsBehind} minor version${s} behind (latest: ${info.latest})`
  }
  return `Patch update available (latest: ${info.latest})`
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
