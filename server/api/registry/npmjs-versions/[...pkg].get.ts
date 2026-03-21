import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { fetchNpmVersionDownloadsFromApi } from '#server/utils/npm-website-versions'

export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const packageName = decodeURIComponent(pkgParam)

    try {
      const parsed = await fetchNpmVersionDownloadsFromApi(packageName)

      if (parsed.versions.length === 0) {
        throw createError({
          statusCode: 502,
          message: 'Failed to fetch version download data',
        })
      }

      return {
        packageName,
        source: 'npm-api',
        sourceUrl: `https://api.npmjs.org/versions/${encodePackageName(packageName)}/last-week`,
        fetchedAt: new Date().toISOString(),
        weeklyDownloads: parsed.weeklyDownloads,
        versions: parsed.versions,
      }
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to fetch version download data from npm API',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `npmjs-versions:v2:${pkg}`
    },
  },
)
