import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR, ERROR_CALC_INSTALL_SIZE_FAILED } from '#shared/utils/constants'

/**
 * GET /api/registry/install-size/:name or /api/registry/install-size/:name/v/:version
 *
 * Calculate total install size for a package including all dependencies.
 * Handles platform-specific optional dependencies by counting only one representative per group.
 */
export default defineCachedEventHandler(
  async event => {
    // Parse package name and optional version from path segments
    // Supports: /install-size/lodash, /install-size/lodash/v/4.17.21, /install-size/@scope/name, /install-size/@scope/name/v/1.0.0
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version: requestedVersion } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
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

      return await calculateInstallSize(packageName, version)
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_CALC_INSTALL_SIZE_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `install-size:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
