import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR, NPM_MISSING_README_SENTINEL } from '#shared/utils/constants'

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

export function isStandardReadme(filename: string | undefined): boolean {
  return !!filename && standardReadmePattern.test(filename)
}

/**
 * Fetch README from jsdelivr CDN for a specific package version.
 * Falls back through common README filenames.
 */
export async function fetchReadmeFromJsdelivr(
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

export const resolvePackageReadmeSource = defineCachedFunction(
  async (packagePath: string) => {
    const pkgParamSegments = packagePath.split('/')

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    const { packageName, version } = v.parse(PackageRouteParamsSchema, {
      packageName: rawPackageName,
      version: rawVersion,
    })

    const packageData = await fetchNpmPackage(packageName)
    const resolvedVersion = version ?? packageData['dist-tags']?.latest

    // Prefer jsDelivr (actual file from npm tarball) because the npm registry
    // truncates the packument readme field at 65,536 characters.
    let readmeContent = await fetchReadmeFromJsdelivr(
      packageName,
      standardReadmeFilenames,
      resolvedVersion,
    )

    // Fall back to packument readme if jsDelivr didn't have a standard README.
    // This covers packages with non-standard readme filenames (e.g. README.zh-TW.md)
    // or packages that don't include a README in the tarball.
    if (!readmeContent) {
      let packumentReadme: string | undefined

      if (version) {
        packumentReadme = packageData.versions?.[version]?.readme
      } else {
        packumentReadme = packageData.readme
      }

      if (packumentReadme && packumentReadme !== NPM_MISSING_README_SENTINEL) {
        readmeContent = packumentReadme
      }
    }

    if (!readmeContent) {
      return {
        packageName,
        version,
        markdown: undefined,
        repoInfo: undefined,
      }
    }

    const repoInfo = parseRepositoryInfo(packageData.repository)

    return {
      packageName,
      version,
      markdown: readmeContent,
      repoInfo,
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: (packagePath: string) => packagePath,
  },
)
