import { generatePackageMarkdown } from '../../utils/markdown'
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { NPM_MISSING_README_SENTINEL, ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'

// Cache TTL matches the ISR config for /raw/** routes (60 seconds)
const CACHE_MAX_AGE = 60
import { parseRepositoryInfo } from '#shared/utils/git-providers'

const NPM_API = 'https://api.npmjs.org'

const standardReadmeFilenames = [
  'README.md',
  'readme.md',
  'Readme.md',
  'README',
  'readme',
  'README.markdown',
  'readme.markdown',
]

const standardReadmePattern = /^readme(\.md|\.markdown)?$/i

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

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

async function fetchWeeklyDownloads(packageName: string): Promise<{ downloads: number } | null> {
  try {
    const encodedName = encodePackageName(packageName)
    return await $fetch<{ downloads: number }>(
      `${NPM_API}/downloads/point/last-week/${encodedName}`,
    )
  } catch {
    return null
  }
}

async function fetchDownloadRange(
  packageName: string,
  weeks: number = 12,
): Promise<Array<{ day: string; downloads: number }> | null> {
  try {
    const encodedName = encodePackageName(packageName)
    const today = new Date()
    const end = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1),
    )
    const start = new Date(end)
    start.setUTCDate(start.getUTCDate() - weeks * 7 + 1)

    const startStr = start.toISOString().split('T')[0]
    const endStr = end.toISOString().split('T')[0]

    const response = await $fetch<{
      downloads: Array<{ day: string; downloads: number }>
    }>(`${NPM_API}/downloads/range/${startStr}:${endStr}/${encodedName}`)

    return response.downloads
  } catch {
    return null
  }
}

function isStandardReadme(filename: string | undefined): boolean {
  return !!filename && standardReadmePattern.test(filename)
}

function parsePackageParamsFromSlug(slug: string): {
  rawPackageName: string
  rawVersion: string | undefined
} {
  const segments = slug.split('/').filter(Boolean)

  if (segments.length === 0) {
    return { rawPackageName: '', rawVersion: undefined }
  }

  const vIndex = segments.indexOf('v')

  if (vIndex !== -1 && vIndex < segments.length - 1) {
    return {
      rawPackageName: segments.slice(0, vIndex).join('/'),
      rawVersion: segments.slice(vIndex + 1).join('/'),
    }
  }

  const fullPath = segments.join('/')
  const versionMatch = fullPath.match(/^(@[^/]+\/[^@]+|[^@]+)@(.+)$/)
  if (versionMatch) {
    const [, packageName, version] = versionMatch as [string, string, string]
    return {
      rawPackageName: packageName,
      rawVersion: version,
    }
  }

  return {
    rawPackageName: fullPath,
    rawVersion: undefined,
  }
}

export default defineEventHandler(async event => {
  // Get the slug parameter - Nitro captures it as "slug.md" due to the route pattern
  const params = getRouterParams(event)
  const slugParam = params['slug.md'] || params.slug

  if (!slugParam) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Package not found',
    })
  }

  // Remove .md suffix if present (it will be there from the route)
  const slug = slugParam.endsWith('.md') ? slugParam.slice(0, -3) : slugParam

  const { rawPackageName, rawVersion } = parsePackageParamsFromSlug(slug)

  if (!rawPackageName) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Package not found',
    })
  }

  const { packageName, version } = v.parse(PackageRouteParamsSchema, {
    packageName: rawPackageName,
    version: rawVersion,
  })

  let packageData
  try {
    packageData = await fetchNpmPackage(packageName)
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: ERROR_NPM_FETCH_FAILED,
    })
  }

  let targetVersion = version
  if (!targetVersion) {
    targetVersion = packageData['dist-tags']?.latest
  }

  if (!targetVersion) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Package version not found',
    })
  }

  const versionData = packageData.versions[targetVersion]
  if (!versionData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Package version not found',
    })
  }

  let readmeContent: string | undefined

  if (version) {
    readmeContent = versionData.readme
  } else {
    readmeContent = packageData.readme
  }

  const readmeFilename = version ? versionData.readmeFilename : packageData.readmeFilename
  const hasValidNpmReadme = readmeContent && readmeContent !== NPM_MISSING_README_SENTINEL

  if (!hasValidNpmReadme || !isStandardReadme(readmeFilename)) {
    const jsdelivrReadme = await fetchReadmeFromJsdelivr(
      packageName,
      standardReadmeFilenames,
      targetVersion,
    )
    if (jsdelivrReadme) {
      readmeContent = jsdelivrReadme
    }
  }

  const [weeklyDownloadsData, dailyDownloads] = await Promise.all([
    fetchWeeklyDownloads(packageName),
    fetchDownloadRange(packageName, 12),
  ])

  const repoInfo = parseRepositoryInfo(packageData.repository)

  const markdown = generatePackageMarkdown({
    pkg: packageData,
    version: versionData,
    readme: readmeContent && readmeContent !== NPM_MISSING_README_SENTINEL ? readmeContent : null,
    weeklyDownloads: weeklyDownloadsData?.downloads,
    dailyDownloads: dailyDownloads ?? undefined,
    repoInfo,
  })

  setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
  setHeader(event, 'Cache-Control', `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate`)

  return markdown
})
