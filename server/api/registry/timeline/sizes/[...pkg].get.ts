import { getVersions } from 'fast-npm-meta'

const DEFAULT_LIMIT = 25

export interface TimelineSizeEntry {
  version: string
  totalSize: number
  dependencyCount: number
}

export interface TimelineSizeResponse {
  sizes: TimelineSizeEntry[]
}

/**
 * Returns install sizes for a page of timeline versions.
 *
 * Uses the same offset/limit and sort order as the timeline endpoint so the
 * client can pair results by position.
 *
 * Examples:
 * - /api/registry/timeline/sizes/packageName?offset=0&limit=25
 * - /api/registry/timeline/sizes/@scope/packageName?offset=0&limit=25
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

    try {
      const { versions, time } = await getVersions(packageName)

      const allVersions = versions
        .filter(v => time[v])
        .sort((a, b) => Date.parse(time[b]!) - Date.parse(time[a]!))

      const pageVersions = allVersions.slice(offset, offset + limit)

      const results = await Promise.allSettled(
        pageVersions.map(v => calculateInstallSize(packageName, v)),
      )

      const sizes: TimelineSizeEntry[] = []
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.totalSize > 0) {
          sizes.push({
            version: result.value.version,
            totalSize: result.value.totalSize,
            dependencyCount: result.value.dependencyCount,
          })
        }
      }

      return { sizes } satisfies TimelineSizeResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: `Failed to fetch install sizes for ${packageName}`,
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
      return `install-size-timeline:v1:${getRouterParam(event, 'pkg')}:${offset}:${limit}`
    },
  },
)
