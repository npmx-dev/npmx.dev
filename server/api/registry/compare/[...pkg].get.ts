import * as v from 'valibot'
import { PackageCompareQuerySchema } from '#shared/schemas/package'
import type { CompareResponse } from '#shared/types'
import { CACHE_MAX_AGE_ONE_YEAR } from '#shared/utils/constants'
import { buildCompareResponse } from '#server/utils/compare'

const CACHE_VERSION = 1
const COMPARE_TIMEOUT = 8000 // 8 seconds

/**
 * Fetch package.json from jsDelivr
 */
async function fetchPackageJson(
  packageName: string,
  version: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://cdn.jsdelivr.net/npm/${packageName}@${version}/package.json`
    const response = await fetch(url, { signal })
    if (!response.ok) return null
    return (await response.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Parse the version range from the URL.
 * Supports formats like: "1.0.0...2.0.0" or "1.0.0..2.0.0"
 */
function parseVersionRange(versionRange: string): { from: string; to: string } | null {
  // Try triple dot first (GitHub style)
  let parts = versionRange.split('...')
  if (parts.length === 2) {
    return { from: parts[0]!, to: parts[1]! }
  }

  // Try double dot
  parts = versionRange.split('..')
  if (parts.length === 2) {
    return { from: parts[0]!, to: parts[1]! }
  }

  return null
}

/**
 * Compare two package versions and return differences.
 *
 * URL patterns:
 * - /api/registry/compare/packageName/v/1.0.0...2.0.0
 * - /api/registry/compare/@scope/packageName/v/1.0.0...2.0.0
 */
export default defineCachedEventHandler(
  async event => {
    const startTime = Date.now()

    // Parse package segments
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const { rawPackageName, rawVersion: rawVersionRange } = parsePackageParams(pkgParamSegments)

    if (!rawVersionRange) {
      throw createError({
        statusCode: 400,
        message: 'Version range is required (e.g., 1.0.0...2.0.0)',
      })
    }

    // Parse version range
    const range = parseVersionRange(rawVersionRange)
    if (!range) {
      throw createError({
        statusCode: 400,
        message: 'Invalid version range format. Use from...to (e.g., 1.0.0...2.0.0)',
      })
    }

    try {
      // Validate inputs
      const { packageName, fromVersion, toVersion } = v.parse(PackageCompareQuerySchema, {
        packageName: rawPackageName,
        fromVersion: range.from,
        toVersion: range.to,
      })

      // Set up abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), COMPARE_TIMEOUT)

      try {
        // Fetch file trees and package.json for both versions in parallel
        const [fromTree, toTree, fromPkg, toPkg] = await Promise.all([
          getPackageFileTree(packageName, fromVersion, controller.signal),
          getPackageFileTree(packageName, toVersion, controller.signal),
          fetchPackageJson(packageName, fromVersion, controller.signal),
          fetchPackageJson(packageName, toVersion, controller.signal),
        ])

        clearTimeout(timeoutId)

        const computeTime = Date.now() - startTime

        return buildCompareResponse(
          packageName,
          fromVersion,
          toVersion,
          fromTree.tree,
          toTree.tree,
          fromPkg,
          toPkg,
          computeTime,
        ) satisfies CompareResponse
      } catch (error) {
        clearTimeout(timeoutId)

        // Check if it was a timeout
        if (error instanceof Error && error.name === 'AbortError') {
          throw createError({
            statusCode: 504,
            message: 'Comparison timed out. Try comparing fewer files.',
          })
        }

        throw error
      }
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to compare package versions',
      })
    }
  },
  {
    // Comparison between specific versions never changes hence cache permanently
    maxAge: CACHE_MAX_AGE_ONE_YEAR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `compare:v${CACHE_VERSION}:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
