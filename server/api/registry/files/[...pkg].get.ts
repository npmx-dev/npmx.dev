import * as v from 'valibot'
import { PackageVersionQuerySchema } from '#shared/schemas/package'
import type { PackageFileTreeResponse } from '#shared/types'
import { CACHE_MAX_AGE_ONE_YEAR, ERROR_FILE_LIST_FETCH_FAILED } from '#shared/utils/constants'

/**
 * Returns the file tree for a package version.
 *
 * URL patterns:
 * - /api/registry/files/packageName/v/1.2.3 - required version
 * - /api/registry/files/@scope/packageName/v/1.2.3 - scoped package
 */
export default defineCachedEventHandler(
  async event => {
    // Parse package name and version from URL segments
    // Patterns: [pkg, 'v', version] or [@scope, pkg, 'v', version]
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version } = v.parse(PackageVersionQuerySchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      const jsDelivrData = await fetchFileTree(packageName, version)
      const tree = convertToFileTree(jsDelivrData.files)

      return {
        package: packageName,
        version,
        default: jsDelivrData.default ?? undefined,
        tree,
      } satisfies PackageFileTreeResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_FILE_LIST_FETCH_FAILED,
      })
    }
  },
  {
    // Files for a specific version never change - cache permanently
    maxAge: CACHE_MAX_AGE_ONE_YEAR, // 1 year
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `files:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
