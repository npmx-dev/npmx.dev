import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

/**
 * GET /api/registry/vulnerabilities/:name or /api/registry/vulnerabilities/:name/v/:version
 *
 * Analyze entire dependency tree for vulnerabilities and deprecated dependencies.
 * I does not rename this endpoint for backward compatibility.
 */
export default defineBypassableCachedEventHandler(
  async event => {
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version: requestedVersion } = v.parse(PackageRouteParamsSchema, {
        packageName: decodeURIComponent(rawPackageName),
        version: rawVersion,
      })

      // If no version specified, resolve to latest using fast-npm-meta (lightweight)
      let version: string | undefined = requestedVersion
      if (!version) {
        const latestVersion = await fetchLatestVersionWithFallback(packageName)
        if (!latestVersion) {
          throw createError({
            statusCode: 404,
            message: 'No latest version found',
          })
        }
        version = latestVersion
      }

      return await analyzeDependencyTree(packageName, version)
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to analyze vulnerabilities',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    bypassKey: 'vulnerabilities',
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `vulnerabilities:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
