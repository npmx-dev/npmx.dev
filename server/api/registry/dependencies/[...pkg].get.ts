import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR, ERROR_CALC_DEPENDENCIES_FAILED } from '#shared/utils/constants'
import { resolveDependencyTree } from '#server/utils/dependency-resolver'
import type { PackageDependenciesResponse } from '#shared/types'

/**
 * GET /api/registry/dependencies/:name or /api/registry/dependencies/:name/v/:version
 *
 * Get the full dependency tree for a package with depth tracking.
 * Returns direct and transitive dependencies with their versions and sizes.
 */
export default defineCachedEventHandler(
  async event => {
    // Parse package name and optional version from path segments
    // Supports: /api/registry/dependencies/lodash (defaults to latest), /api/registry/dependencies/lodash/v/4.17.21, /api/registry/dependencies/@scope/name, /api/registry/dependencies/@scope/name/v/1.0.0
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version: requestedVersion } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      // If no version specified, resolve to latest
      let version = requestedVersion
      let packument
      if (!version) {
        packument = await fetchNpmPackage(packageName)
        version = packument['dist-tags']?.latest
        if (!version) {
          throw createError({
            statusCode: 404,
            message: 'No latest version found',
          })
        }
      } else {
        packument = await fetchNpmPackage(packageName)
      }

      // Get package version data for dev dependencies
      const versionData = packument?.versions[version]

      // Resolve dependency tree with depth tracking
      const dependencies = await resolveDependencyTree(packageName, version, { trackDepth: true })

      // Convert to array and sort by depth and name
      const dependencyList = Array.from(dependencies.values())
        .filter(dep => dep.depth !== 'root') // Exclude the root package itself
        .sort((a, b) => {
          // Sort by depth first (direct before transitive)
          const depthOrder: Record<string, number> = { direct: 0, transitive: 1 }
          const depthDiff = (depthOrder[a.depth!] ?? 2) - (depthOrder[b.depth!] ?? 2)
          if (depthDiff !== 0) return depthDiff

          // Then by name
          return a.name.localeCompare(b.name)
        })

      const result: PackageDependenciesResponse = {
        package: packageName,
        version,
        dependencies: dependencyList,
        total: dependencyList.length,
        direct: dependencyList.filter(dep => dep.depth === 'direct').length,
        transitive: dependencyList.filter(dep => dep.depth === 'transitive').length,
        devDependencies: versionData?.devDependencies,
      }

      return result
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_CALC_DEPENDENCIES_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `dependencies:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
