import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import {
  CACHE_MAX_AGE_ONE_HOUR,
  NPM_MISSING_README_SENTINEL,
  ERROR_NPM_FETCH_FAILED,
} from '#shared/utils/constants'

/** Standard README filenames to try when fetching from jsdelivr (case-sensitive CDN) */
const standardReadmeFilenames = [
  'README.md',
  'readme.md',
  'Readme.md',
  'README',
  'readme',
  'README.markdown',
  'readme.markdown',
]

/** Matches standard README filenames (case-insensitive, for checking registry metadata) */
const standardReadmePattern = /^readme(?:\.md|\.markdown)?$/i

/**
 * Fetch README from jsdelivr CDN for a specific package version.
 * Falls back through common README filenames.
 */
async function fetchReadmeFromJsdelivr(
  packageName: string,
  readmeFilenames: string[],
  version?: string,
): Promise<string | null> {
  const versionSuffix = version ? `@${version}` : ''

  for (const filename of readmeFilenames) {
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
    // Parse package name and optional version from URL segments
    // Patterns: [pkg] or [pkg, 'v', version] or [@scope, pkg] or [@scope, pkg, 'v', version]
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      // 1. Validate
      const { packageName, version } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      const packageData = await fetchNpmPackage(packageName)

      let readmeContent: string | undefined
      let readmeFilename: string | undefined

      // If a specific version is requested, get README from that version
      if (version) {
        const versionData = packageData.versions[version]
        if (versionData) {
          readmeContent = versionData.readme
          readmeFilename = versionData.readmeFilename
        }
      } else {
        // Use the packument-level readme (from latest version)
        readmeContent = packageData.readme
        readmeFilename = packageData.readmeFilename
      }

      const hasValidNpmReadme = readmeContent && readmeContent !== NPM_MISSING_README_SENTINEL

      // If no README in packument, or if readmeFilename is non-standard (e.g., README.zh-TW.md),
      // try fetching a standard README from jsdelivr (package tarball).
      // Note: When readmeFilename is missing, we defensively fetch from jsdelivr to ensure
      // we get a standard English README if one exists.
      if (!hasValidNpmReadme || !isStandardReadme(readmeFilename)) {
        const jsdelivrReadme = await fetchReadmeFromJsdelivr(
          packageName,
          standardReadmeFilenames,
          version,
        )
        // Only replace npm content if jsdelivr returned something
        if (jsdelivrReadme) {
          readmeContent = jsdelivrReadme
        }
      }

      if (!readmeContent || readmeContent === NPM_MISSING_README_SENTINEL) {
        return { html: '', playgroundLinks: [], toc: [] }
      }

      // Parse repository info for resolving relative URLs to GitHub
      const repoInfo = parseRepositoryInfo(packageData.repository)

      return await renderReadmeHtml(readmeContent, packageName, repoInfo)
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_NPM_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `readme:v8:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)

function isStandardReadme(filename: string | undefined): boolean {
  return !!filename && standardReadmePattern.test(filename)
}
