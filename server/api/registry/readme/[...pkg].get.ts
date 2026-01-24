import { parseRepositoryInfo } from '#server/utils/readme'

/**
 * Fetch README from jsdelivr CDN for a specific package version.
 * Falls back through common README filenames.
 */
async function fetchReadmeFromJsdelivr(
  packageName: string,
  version?: string,
): Promise<string | null> {
  const filenames = ['README.md', 'readme.md', 'Readme.md', 'README', 'readme']
  const versionSuffix = version ? `@${version}` : ''

  for (const filename of filenames) {
    try {
      const url = `https://cdn.jsdelivr.net/npm/${packageName}${versionSuffix}/${filename}`
      const response = await fetch(url)
      if (response.ok) {
        return await response.text()
      }
    } catch {
      // Try next filename
    }
  }

  return null
}

/**
 * Returns rendered README HTML for a package.
 *
 * URL patterns:
 * - /api/registry/readme/packageName - latest version
 * - /api/registry/readme/packageName/v/1.2.3 - specific version
 * - /api/registry/readme/@scope/packageName - scoped package, latest
 * - /api/registry/readme/@scope/packageName/v/1.2.3 - scoped package, specific version
 */
export default defineCachedEventHandler(
  async event => {
    const segments = getRouterParam(event, 'pkg')?.split('/') ?? []
    if (segments.length === 0) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    // Parse package name and optional version from URL segments
    // Patterns: [pkg] or [pkg, 'v', version] or [@scope, pkg] or [@scope, pkg, 'v', version]
    let packageName: string
    let version: string | undefined

    const vIndex = segments.indexOf('v')
    if (vIndex !== -1 && vIndex < segments.length - 1) {
      packageName = segments.slice(0, vIndex).join('/')
      version = segments.slice(vIndex + 1).join('/')
    } else {
      packageName = segments.join('/')
    }

    if (!packageName) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    try {
      const packageData = await fetchNpmPackage(packageName)

      let readmeContent: string | undefined

      // If a specific version is requested, get README from that version
      if (version) {
        const versionData = packageData.versions[version]
        if (versionData) {
          readmeContent = versionData.readme
        }
      } else {
        // Use the packument-level readme (from latest version)
        readmeContent = packageData.readme
      }

      // If no README in packument, try fetching from jsdelivr (package tarball)
      if (!readmeContent || readmeContent === 'ERROR: No README data found!') {
        readmeContent = (await fetchReadmeFromJsdelivr(packageName, version)) ?? undefined
      }

      if (!readmeContent) {
        return { html: '' }
      }

      // Parse repository info for resolving relative URLs to GitHub
      const repoInfo = parseRepositoryInfo(packageData.repository)

      const html = await renderReadmeHtml(readmeContent, packageName, repoInfo)
      return { html }
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 502, message: 'Failed to fetch package from npm registry' })
    }
  },
  {
    maxAge: 60 * 10,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `readme:${pkg}`
    },
  },
)
