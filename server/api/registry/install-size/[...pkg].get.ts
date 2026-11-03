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
        packageName: decodeURIComponent(rawPackageName),
        version: rawVersion,
      })

      // If no version specified, resolve to latest using fast-npm-meta (lightweight)
      if (!requestedVersion) {
        const latestVersion = await fetchLatestVersionWithFallback(packageName)
        if (!latestVersion) {
          throw createError({
            statusCode: 404,
            message: 'No latest version found',
          })
        }
        return await calculateInstallSize(packageName, latestVersion)
      }

      // If `frozen-history` is enabled, limit dependency resolution to before
      // the next package version.
      const before = parseFrozenHistory(getQuery(event)['frozen-history'])
        ? await getDependenciesResolutionLimit(packageName, requestedVersion)
        : undefined

      return await calculateInstallSize(packageName, requestedVersion, before)
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
      const frozenHistory = parseFrozenHistory(getQuery(event)['frozen-history'])
      return `install-size:v2:${pkg.replace(/\/+$/, '').trim()}:${frozenHistory}`
    },
  },
)
