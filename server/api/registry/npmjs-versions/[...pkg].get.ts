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
      const versions = await fetchNpmVersionDownloadsFromApi(packageName)

      return {
        packageName,
        versions,
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
