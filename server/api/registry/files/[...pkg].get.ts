import type { PackageFileTreeResponse } from '#shared/types'

/**
 * Returns the file tree for a package version.
 *
 * URL patterns:
 * - /api/registry/files/packageName/v/1.2.3 - required version
 * - /api/registry/files/@scope/packageName/v/1.2.3 - scoped package
 */
export default defineCachedEventHandler(
  async (event) => {
    const segments = getRouterParam(event, 'pkg')?.split('/') ?? []
    if (segments.length === 0) {
      throw createError({ statusCode: 400, message: 'Package name and version are required' })
    }

    // Parse package name and version from URL segments
    // Patterns: [pkg, 'v', version] or [@scope, pkg, 'v', version]
    const vIndex = segments.indexOf('v')
    if (vIndex === -1 || vIndex >= segments.length - 1) {
      throw createError({ statusCode: 400, message: 'Version is required (use /v/{version})' })
    }

    const packageName = segments.slice(0, vIndex).join('/')
    const version = segments.slice(vIndex + 1).join('/')

    if (!packageName || !version) {
      throw createError({ statusCode: 400, message: 'Package name and version are required' })
    }

    try {
      const jsDelivrData = await fetchFileTree(packageName, version)
      const tree = convertToFileTree(jsDelivrData.files)

      return {
        package: packageName,
        version,
        default: jsDelivrData.default ?? undefined,
        tree,
      } satisfies PackageFileTreeResponse
    }
    catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 502, message: 'Failed to fetch file list' })
    }
  },
  {
    maxAge: 60 * 60, // Cache for 1 hour (files don't change for a given version)
    getKey: (event) => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `files:${pkg}`
    },
  },
)
