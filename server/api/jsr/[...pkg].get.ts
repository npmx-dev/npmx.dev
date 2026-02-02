import * as v from 'valibot'
import { PackageNameSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR, ERROR_JSR_FETCH_FAILED } from '#shared/utils/constants'
import type { JsrPackageInfo } from '#shared/types/jsr'

/**
 * Check if an npm package exists on JSR.
 *
 * GET /api/jsr/:pkg
 *
 * @example GET /api/jsr/@std/fs → { exists: true, scope: "std", name: "fs", ... }
 * @example GET /api/jsr/lodash → { exists: false }
 */
export default defineBypassableCachedEventHandler<Promise<JsrPackageInfo>>(
  async event => {
    const pkgPath = getRouterParam(event, 'pkg')

    try {
      const packageName = v.parse(PackageNameSchema, pkgPath)

      return await fetchJsrPackageInfo(packageName)
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_JSR_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'api-jsr-package',
    bypassKey: 'jsr',
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `jsr:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
