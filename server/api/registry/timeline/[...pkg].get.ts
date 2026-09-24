import { compare, tryParse } from 'verkit'
import { normalizeLicense } from '#shared/utils/npm'
import { hasBuiltInTypes } from '~~/shared/utils/package-analysis'

const DEFAULT_LIMIT = 25

export type TimelineSort = 'time' | 'semver'

export function parseTimelineSort(value: unknown): TimelineSort {
  return value === 'time' ? 'time' : 'semver'
}

export function parseStableOnly(value: unknown): boolean {
  return value === 'true'
}

export function isStableVersion(version: string): boolean {
  const parsed = tryParse(version)
  return !!parsed && (parsed.prerelease?.length ?? 0) === 0
}

export interface TimelineVersion {
  version: string
  time: string
  license?: string
  type?: string
  hasTypes?: boolean
  hasTrustedPublisher?: boolean
  hasProvenance?: boolean
  deprecated?: string
  tags: string[]
}

export interface TimelineResponse {
  versions: TimelineVersion[]
  total: number
  /** Effective offset of the returned page (page-aligned when `around` is used) */
  offset: number
}

export interface SubEvent {
  key: string
  state: 'success' | 'error' | 'warn'
  icon: string
  text: string
}

/**
 * Returns paginated version timeline data for a package.
 *
 * Fetches the full packument server-side, extracts only the fields needed
 * for the timeline view, optionally drops pre-releases (`stable-only=true`),
 * sorts (descending) by publish time (default) or by semver (`sort=semver`),
 * then paginates.
 *
 * Instead of an explicit `offset`, `around=<version>` returns the page-aligned
 * slice containing that version (`offset = floor(index / limit) * limit`), so
 * anchored requests still map onto the same shared page boundaries. The
 * response reports the effective `offset` so clients can paginate from there
 * in both directions.
 *
 * Examples:
 * - /api/registry/timeline/packageName?offset=0&limit=25
 * - /api/registry/timeline/packageName?around=3.0.0&limit=25
 * - /api/registry/timeline/@scope/packageName?offset=0&limit=25&sort=semver&stable-only=true
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    let packageName: string
    try {
      packageName = decodeURIComponent(pkgParam)
    } catch {
      throw createError({ statusCode: 400, message: 'Invalid package name encoding' })
    }

    const query = getQuery(event)
    let offset = Math.max(0, Number(query.offset) || 0)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))
    const sort = parseTimelineSort(query.sort)
    const stableOnly = parseStableOnly(query['stable-only'])
    const around = typeof query.around === 'string' ? query.around : undefined

    try {
      const packument = await fetchNpmPackage(packageName)

      const tagsByVersion = new Map<string, string[]>()
      for (const [tag, ver] of Object.entries(packument['dist-tags'] ?? {})) {
        const list = tagsByVersion.get(ver)
        if (list) list.push(tag)
        else tagsByVersion.set(ver, [tag])
      }

      // Build full sorted list
      const allVersions = Object.keys(packument.versions).filter(
        v => packument.time[v] && (!stableOnly || isStableVersion(v)),
      )

      if (sort === 'semver') {
        allVersions.sort((a, b) => compare(b, a))
      } else {
        allVersions.sort((a, b) => Date.parse(packument.time[b]!) - Date.parse(packument.time[a]!))
      }

      if (around) {
        // Snap to the page boundary containing the anchor version so anchored
        // requests reuse the same page slices as plain offset pagination.
        const index = allVersions.indexOf(around)
        offset = index === -1 ? 0 : Math.floor(index / limit) * limit
      }

      const versions = allVersions.slice(offset, offset + limit)

      const versionsData = versions
        .map(v => {
          const version = packument.versions[v]!

          return {
            version: v,
            time: packument.time[v]!,
            license: normalizeLicense(version.license),
            type: typeof version.type === 'string' ? version.type : undefined,
            hasTypes: hasBuiltInTypes(version) || undefined,
            // oxlint-disable-next-line eslint/no-underscore-dangle
            hasTrustedPublisher: version._npmUser?.trustedPublisher ? true : undefined,
            hasProvenance: version.dist?.attestations ? true : undefined,
            deprecated: version.deprecated || undefined,
            tags: tagsByVersion.get(v) ?? [],
          }
        })
        // Both orderings are descending (newest / highest first), mirroring the
        // list's newest-first default; the chart consumes a reversed copy.
        .sort((a, b) =>
          sort === 'semver'
            ? compare(b.version, a.version)
            : Date.parse(b.time) - Date.parse(a.time),
        )

      return {
        versions: versionsData,
        total: allVersions.length,
        offset,
      } satisfies TimelineResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: `Failed to fetch timeline for ${packageName}`,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      const offset = Math.max(0, Number(query.offset) || 0)
      const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))
      const sort = parseTimelineSort(query.sort)
      const stableOnly = parseStableOnly(query['stable-only'])
      const around = typeof query.around === 'string' ? query.around : undefined
      // `around` supersedes `offset`, so anchored requests get their own key
      // (one per anchor version - same cardinality as the per-version pages).
      const page = around ? `around=${around}` : offset
      return `timeline:v2:${getRouterParam(event, 'pkg')}:${sort}:${stableOnly}:${page}:${limit}`
    },
  },
)
