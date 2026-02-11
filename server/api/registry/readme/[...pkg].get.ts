import { CACHE_MAX_AGE_ONE_HOUR, ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { resolvePackageReadmeSource } from '#server/utils/readme-loaders'

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
    try {
      const packagePath = getRouterParam(event, 'pkg') ?? ''
      const { packageName, markdown, repoInfo } = await resolvePackageReadmeSource(packagePath)

      if (!markdown) {
        return { html: '', mdExists: false, playgroundLinks: [], toc: [] }
      }

      return await renderReadmeHtml(markdown, packageName, repoInfo)
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
