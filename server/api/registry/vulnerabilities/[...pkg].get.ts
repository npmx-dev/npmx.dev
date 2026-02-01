import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

/**
 * GET /api/registry/vulnerabilities/:name or /api/registry/vulnerabilities/:name/v/:version
 *
 * Analyze entire dependency tree for vulnerabilities and deprecated dependencies.
 * I does not rename this endpoint for backward compatibility.
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version: requestedVersion } = v.parse(PackageRouteParamsSchema, {
        packageName: decodeURIComponent(rawPackageName),
        version: rawVersion,
      })

      // If no version specified, resolve to latest
      let version = requestedVersion
      if (!version) {
        const packument = await fetchNpmPackage(packageName)
        version = packument['dist-tags']?.latest
        if (!version) {
          throw createError({
            statusCode: 404,
            message: 'No latest version found',
          })
        }
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
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `vulnerabilities:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
