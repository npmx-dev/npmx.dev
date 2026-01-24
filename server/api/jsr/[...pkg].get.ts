import type { JsrPackageInfo } from '#shared/types/jsr'

/**
 * Check if an npm package exists on JSR.
 *
 * GET /api/jsr/:pkg
 *
 * @example GET /api/jsr/@std/fs → { exists: true, scope: "std", name: "fs", ... }
 * @example GET /api/jsr/lodash → { exists: false }
 */
export default defineCachedEventHandler<Promise<JsrPackageInfo>>(
  async event => {
    const pkgPath = getRouterParam(event, 'pkg')
    if (!pkgPath) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    return await fetchJsrPackageInfo(pkgPath)
  },
  {
    maxAge: 60 * 60, // 1 hour
    name: 'api-jsr-package',
    getKey: event => getRouterParam(event, 'pkg') ?? '',
  },
)
