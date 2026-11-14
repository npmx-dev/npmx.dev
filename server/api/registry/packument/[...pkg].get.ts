import { transformPackument } from '#shared/utils/packument'
import { CACHE_MAX_AGE_FIVE_MINUTES, ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'

/**
 * Returns an already-trimmed ("slim") packument for a package page render.
 *
 * Fetches the full packument via `fetchNpmPackage` so a server-rendered package
 * page shares a single (Nitro-cached) download of the potentially huge document
 * with the other server routes that need it (license-change, readme, ...). Only
 * the small trimmed subset is returned and cached here, so clients download a
 * few KB instead of potentially tens of MB.
 *
 * The transform depends on the requested version, so the `version` query
 * parameter is part of the cache key. The value may be an exact version or a
 * dist-tag (e.g. `latest`, `next`); it is resolved against the packument before
 * transforming. When omitted it defaults to the `latest` dist-tag, so callers
 * that only need the current version get its full manifest in the response.
 *
 * URL patterns:
 * - /api/registry/packument/packageName?version=1.2.3
 * - /api/registry/packument/@scope/packageName?version=next
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const packageName = decodeURIComponent(pkgParam)
    const rawVersion = getQuery(event).version
    const requestedVersion = typeof rawVersion === 'string' ? rawVersion : null

    try {
      const packument = await fetchNpmPackage(packageName)

      // Resolve the requested version (an exact version or a dist-tag) to a
      // concrete version so the transform includes that version's full
      // manifest. Defaults to the `latest` dist-tag when none was requested.
      const resolvedVersion = requestedVersion
        ? (packument['dist-tags']?.[requestedVersion] ??
          (packument.versions[requestedVersion] ? requestedVersion : null))
        : (packument['dist-tags']?.latest ?? null)

      return transformPackument(packument, resolvedVersion)
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
      const version = getQuery(event).version
      return `packument:v1:${getRouterParam(event, 'pkg') ?? ''}:${typeof version === 'string' ? version : ''}`
    },
  },
)
