import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import {
  CACHE_MAX_AGE_ONE_HOUR,
  NPM_MISSING_README_SENTINEL,
  NPM_README_TRUNCATION_THRESHOLD,
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
const JSDELIVR_README_FETCH_BATCH_SIZE = 3

export function isStandardReadme(filename: string | undefined): boolean {
  return !!filename && standardReadmePattern.test(filename)
}

async function cancelUnreadBatchResponses(
  responses: Array<Response | null>,
  startIndex: number,
): Promise<void> {
  await Promise.allSettled(responses.slice(startIndex).map(response => response?.body?.cancel()))
}

function buildReadmeFetchCandidates(readmeFilename: string | undefined): string[] {
  return readmeFilename
    ? standardReadmeFilenames.filter(name => name !== readmeFilename)
    : standardReadmeFilenames
}

/**
 * Fetch README from jsdelivr CDN for a specific package version.
 * Falls back through candidate README filenames in small parallel batches.
 */
export async function fetchReadmeFromJsdelivr(
  packageName: string,
  readmeFilenames: string[],
  version?: string,
): Promise<string | null> {
  const versionSuffix = version ? `@${version}` : ''

  for (let index = 0; index < readmeFilenames.length; index += JSDELIVR_README_FETCH_BATCH_SIZE) {
    const batch = readmeFilenames.slice(index, index + JSDELIVR_README_FETCH_BATCH_SIZE)
    const responses = await Promise.all(
      batch.map(async filename => {
        try {
          const url = `https://cdn.jsdelivr.net/npm/${packageName}${versionSuffix}/${filename}`
          const response = await fetch(url)
          if (!response.ok) {
            return null
          }

          return response
        } catch {
          return null
        }
      }),
    )

    for (const [responseIndex, response] of responses.entries()) {
      const text = await response?.text()
      if (text?.trim()) {
        await cancelUnreadBatchResponses(responses, responseIndex + 1)
        return text
      }
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

    let readmeContent: string | undefined
    let readmeFilename: string | undefined

    if (version) {
      const versionData = packageData.versions[version]
      if (versionData) {
        readmeContent = versionData.readme
        readmeFilename = versionData.readmeFilename
      }
    } else {
      readmeContent = packageData.readme
      readmeFilename = packageData.readmeFilename
    }

    const hasValidNpmReadme = readmeContent && readmeContent !== NPM_MISSING_README_SENTINEL

    if (
      !hasValidNpmReadme ||
      !isStandardReadme(readmeFilename) ||
      readmeContent!.length >= NPM_README_TRUNCATION_THRESHOLD
    ) {
      const resolvedVersion = version ?? packageData['dist-tags']?.latest

      // try fetching the given readme file first
      let jsdelivrReadme =
        readmeFilename &&
        (await fetchReadmeFromJsdelivr(packageName, [readmeFilename], resolvedVersion))

      // if it's unsuccessful, fetch all known readme filenames
      if (!jsdelivrReadme) {
        const readmeCandidates = buildReadmeFetchCandidates(readmeFilename)
        jsdelivrReadme = await fetchReadmeFromJsdelivr(
          packageName,
          readmeCandidates,
          resolvedVersion,
        )
      }

      // if we found something, use it
      if (jsdelivrReadme) {
        readmeContent = jsdelivrReadme
      }
    }

    if (!readmeContent || readmeContent === NPM_MISSING_README_SENTINEL) {
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
