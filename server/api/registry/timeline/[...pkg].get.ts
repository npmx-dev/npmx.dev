import { compare } from 'verkit'
import { normalizeLicense } from '#shared/utils/npm'
import { hasBuiltInTypes } from '~~/shared/utils/package-analysis'

const DEFAULT_LIMIT = 25

export type TimelineSort = 'time' | 'semver'

function parseSort(value: unknown): TimelineSort {
  return value === 'semver' ? 'semver' : 'time'
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
 * for the timeline view, sorted (descending) by publish time (default) or by
 * semver via the `sort` query param, before pagination.
 *
 * Examples:
 * - /api/registry/timeline/packageName?offset=0&limit=25
 * - /api/registry/timeline/@scope/packageName?offset=0&limit=25&sort=semver
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
    const offset = Math.max(0, Number(query.offset) || 0)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))
    const sort = parseSort(query.sort)

    try {
      const packument = await fetchNpmPackage(packageName)

      const tagsByVersion = new Map<string, string[]>()
      for (const [tag, ver] of Object.entries(packument['dist-tags'] ?? {})) {
        const list = tagsByVersion.get(ver)
        if (list) list.push(tag)
        else tagsByVersion.set(ver, [tag])
      }

      // Build full sorted list
      const allVersions = Object.keys(packument.versions)
        .filter(v => packument.time[v])
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
        versions: allVersions.slice(offset, offset + limit),
        total: allVersions.length,
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
      const sort = parseSort(query.sort)
      return `timeline:v1:${getRouterParam(event, 'pkg')}:${sort}:${offset}:${limit}`
    },
  },
)
