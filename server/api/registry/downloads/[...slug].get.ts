import { getQuery } from 'h3'
import * as v from 'valibot'
import { hash } from 'ohash'
import type { VersionDistributionResponse } from '#shared/types'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { groupVersionDownloads } from '#server/utils/version-downloads'

/**
 * Raw response from npm downloads API
 * GET https://api.npmjs.org/versions/{package}/last-week
 */
interface NpmVersionDownloadsResponse {
  package: string
  downloads: Record<string, number>
}

/**
 * Query parameter validation schema
 */
const QuerySchema = v.object({
  mode: v.optional(v.picklist(['major', 'minor'] as const), 'major'),
  filterThreshold: v.optional(
    v.pipe(
      v.string(),
      v.toNumber(), // Fails validation on invalid conversion (e.g., "abc") instead of producing NaN
      v.minValue(0), // Ensure non-negative values
    ),
  ),
  filterOldVersions: v.optional(v.picklist(['true', 'false'] as const), 'false'),
})

/**
 * GET /api/registry/downloads/:name/versions or /api/registry/downloads/@scope/name/versions
 *
 * Fetch per-version download statistics and group by major or minor version.
 * Data is cached for 1 hour with stale-while-revalidate.
 *
 * Query parameters:
 * - mode: 'major' | 'minor' (default: 'major')
 * - filterThreshold: minimum percentage to include (default: 1)
 * - filterOldVersions: 'true' to include only versions published in last year (default: 'false')
 */
export default defineCachedEventHandler(
  async event => {
    // Supports: /downloads/lodash/versions, /downloads/@scope/name/versions
    const slugParam = getRouterParam(event, 'slug')
    const pkgParamSegments = slugParam?.split('/') ?? []

    const lastSegment = pkgParamSegments.at(-1)
    if (!lastSegment || lastSegment !== 'versions') {
      throw createError({
        statusCode: 404,
        message: 'Invalid endpoint. Expected /versions',
      })
    }

    const segments = pkgParamSegments.slice(0, -1)

    const { rawPackageName } = parsePackageParams(segments)

    if (!rawPackageName) {
      throw createError({
        statusCode: 404,
        message: 'Package name is required',
      })
    }

    try {
      const query = getQuery(event)
      const parsed = v.parse(QuerySchema, query)
      const mode = parsed.mode
      const filterThreshold = parsed.filterThreshold ?? 1
      const filterOldVersionsBool = parsed.filterOldVersions === 'true'

      const url = `https://api.npmjs.org/versions/${rawPackageName}/last-week`
      const npmResponse = await fetch(url)

      if (!npmResponse.ok) {
        if (npmResponse.status === 404) {
          throw createError({
            statusCode: 404,
            message: 'Package not found',
          })
        }
        throw createError({
          statusCode: 502,
          message: 'Failed to fetch version download data from npm API',
        })
      }

      const data: NpmVersionDownloadsResponse = await npmResponse.json()

      let groups = groupVersionDownloads(data.downloads, mode)

      if (filterThreshold > 0) {
        groups = groups.filter(group => group.percentage >= filterThreshold)
      }

      const totalDownloads = Object.values(data.downloads).reduce((sum, count) => sum + count, 0)

      const apiResponse: VersionDistributionResponse = {
        package: rawPackageName,
        mode,
        totalDownloads,
        groups,
        timestamp: new Date().toISOString(),
      }

      if (filterOldVersionsBool) {
        try {
          const oneYearAgo = new Date()
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
          const afterDate = oneYearAgo.toISOString()

          // Decode package name in case it's URL-encoded (e.g., %40prisma%2Fclient -> @prisma/client)
          const decodedPackageName = decodeURIComponent(rawPackageName)

          // Fetch directly from npm-fast-meta HTTP API
          const fastMetaUrl = `https://npm.antfu.dev/versions/${encodeURIComponent(decodedPackageName)}?after=${encodeURIComponent(afterDate)}`
          const fastMetaResponse = await fetch(fastMetaUrl)

          if (!fastMetaResponse.ok) {
            throw new Error(`npm-fast-meta returned ${fastMetaResponse.status}`)
          }

          const versionData = (await fastMetaResponse.json()) as { versions: string[] }
          apiResponse.recentVersions = versionData.versions
        } catch {
          // Graceful degradation - don't fail entire request if npm-fast-meta fails
        }
      }

      return apiResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to fetch version download distribution',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const slug = getRouterParam(event, 'slug') ?? ''
      const query = getQuery(event)
      // Use ohash to create deterministic cache key from query params
      // This ensures different param combinations = different cache entries
      return `version-downloads:v5:${slug}:${hash(query)}`
    },
  },
)
