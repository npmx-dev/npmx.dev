import { hasBuiltInTypes } from '~~/shared/utils/package-analysis'

const DEFAULT_LIMIT = 25

export interface TimelineVersion {
  version: string
  time: string
  license?: string
  type?: string
  hasTypes?: boolean
  hasTrustedPublisher?: boolean
  hasProvenance?: boolean
  tags: string[]
}

export interface TimelineResponse {
  versions: TimelineVersion[]
  total: number
}

/**
 * Returns paginated version timeline data for a package.
 *
 * Fetches the full packument server-side, extracts only the fields needed
 * for the timeline view, sorted by publish time (newest first).
 *
 * Examples:
 * - /api/registry/timeline/packageName?offset=0&limit=25
 * - /api/registry/timeline/@scope/packageName?offset=0&limit=25
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
    }
    catch {
      throw createError({ statusCode: 400, message: 'Invalid package name encoding' })
    }

    const query = getQuery(event)
    const offset = Math.max(0, Number(query.offset) || 0)
    const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))

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
          let license = version.license
          if (license && typeof license === 'object' && 'type' in license) {
            license = (license as { type: string }).type
          }

          return {
            version: v,
            time: packument.time[v]!,
            license: typeof license === 'string' ? license : undefined,
            type: typeof version.type === 'string' ? version.type : undefined,
            hasTypes: hasBuiltInTypes(version) || undefined,
            hasTrustedPublisher: version._npmUser?.trustedPublisher ? true : undefined,
            hasProvenance: version.dist?.attestations ? true : undefined,
            tags: tagsByVersion.get(v) ?? [],
          }
        })
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())

      return {
        versions: allVersions.slice(offset, offset + limit),
        total: allVersions.length,
      } satisfies TimelineResponse
    }
    catch (error: unknown) {
      handleApiError(error, { statusCode: 502, message: `Failed to fetch timeline for ${packageName}` })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    getKey: event => {
      const query = getQuery(event)
      const offset = Math.max(0, Number(query.offset) || 0)
      const limit = Math.max(1, Math.min(100, Number(query.limit) || DEFAULT_LIMIT))
      return `timeline:v1:${getRouterParam(event, 'pkg')}:${offset}:${limit}`
    },
  },
)
