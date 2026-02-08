import type { NpmDownloadCount } from '#shared/types'
import {
  CACHE_MAX_AGE_FIVE_MINUTES,
  ERROR_NPM_FETCH_FAILED,
  NPM_API,
} from '#shared/utils/constants'
import { encodePackageName } from '#shared/utils/npm'

/**
 * Returns lightweight package metadata for search results.
 *
 * Fetches the full packument + weekly downloads server-side, extracts only
 * the fields needed for package cards, and returns a small JSON payload.
 * This avoids sending the full packument (which can be MBs) to the client.
 *
 * URL patterns:
 * - /api/registry/package-meta/packageName
 * - /api/registry/package-meta/@scope/packageName
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const packageName = decodeURIComponent(pkgParam)
    const encodedName = encodePackageName(packageName)

    try {
      const [packument, downloads] = await Promise.all([
        fetchNpmPackage(packageName),
        $fetch<NpmDownloadCount>(`${NPM_API}/downloads/point/last-week/${encodedName}`).catch(
          () => null,
        ),
      ])

      const latestVersion =
        packument['dist-tags']?.latest || Object.values(packument['dist-tags'] ?? {})[0] || ''
      const modified = packument.time?.modified || packument.time?.[latestVersion] || ''
      const date = packument.time?.[latestVersion] || modified

      // Extract repository URL from the packument's repository field
      // TODO: @npm/types says repository is always an object, but some old
      // packages have a bare string in the registry JSON
      let repositoryUrl: string | undefined
      if (packument.repository) {
        const repo = packument.repository as { url?: string } | string
        const rawUrl = typeof repo === 'string' ? repo : repo.url
        if (rawUrl) {
          // Normalize git+https:// and git:// URLs to https://
          repositoryUrl = rawUrl
            .replace(/^git\+/, '')
            .replace(/^git:\/\//, 'https://')
            .replace(/\.git$/, '')
        }
      }

      // Extract bugs URL
      // TODO: @npm/types types bugs as { email?: string; url?: string } on
      // packuments, but some old packages store it as a plain URL string
      let bugsUrl: string | undefined
      if (packument.bugs) {
        const bugs = packument.bugs as { url?: string } | string
        bugsUrl = typeof bugs === 'string' ? bugs : bugs.url
      }

      // Normalize author field to NpmPerson shape
      // TODO: @npm/types types author as Contact (object), but some old
      // packages store it as a plain string (e.g. "Name <email>")
      let author: { name?: string; email?: string; url?: string } | undefined
      if (packument.author) {
        const a = packument.author as { name?: string; email?: string; url?: string } | string
        author = typeof a === 'string' ? { name: a } : { name: a.name, email: a.email, url: a.url }
      }

      // Normalize license to a string
      // TODO: @npm/types types license as string, but some old packages use
      // the deprecated { type, url } object format
      const license = packument.license
        ? typeof packument.license === 'string'
          ? packument.license
          : (packument.license as { type: string }).type
        : undefined

      return {
        name: packument.name,
        version: latestVersion,
        description: packument.description,
        keywords: packument.keywords,
        license,
        date,
        links: {
          npm: `https://www.npmjs.com/package/${packument.name}`,
          homepage: packument.homepage,
          repository: repositoryUrl,
          bugs: bugsUrl,
        },
        author,
        maintainers: packument.maintainers,
        weeklyDownloads: downloads?.downloads,
      }
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_NPM_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `package-meta:v1:${pkg}`
    },
  },
)
