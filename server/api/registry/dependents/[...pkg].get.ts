/**
 * Returns a paginated list of packages that depend on the given package.
 *
 * Uses the npm search API with a `dependencies:` text filter.
 *
 * URL patterns:
 * - /api/registry/dependents/packageName?page=0&size=20
 * - /api/registry/dependents/@scope/packageName?page=0&size=20
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    const packageName = decodeURIComponent(pkgParam)
    const query = getQuery(event)
    const page = Number(query.page ?? 0)
    const size = Math.min(Number(query.size ?? 20), 50)

    const params = new URLSearchParams({
      text: `dependencies:${packageName}`,
      size: String(size),
      from: String(page * size),
    })

    const response = await $fetch<NpmSearchResponse>(
      `${NPM_REGISTRY}/-/v1/search?${params}`,
    )

    return {
      total: response.total,
      page,
      size,
      packages: response.objects.map(obj => ({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description ?? null,
        date: obj.package.date ?? null,
        score: obj.score?.final ?? 0,
      })),
    }
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      const query = getQuery(event)
      return `dependents:${pkg}:${query.page ?? 0}:${query.size ?? 20}`
    },
  },
)
