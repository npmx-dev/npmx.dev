import { CACHE_MAX_AGE_FIVE_MINUTES } from '#shared/utils/constants'

const NPM_SEARCH_BASE = 'https://registry.npmjs.org/-/v1/search'

interface NpmSearchResult {
  objects: Array<{
    package: {
      name: string
      version: string
      description?: string
      date?: string
      links?: {
        npm?: string
        homepage?: string
        repository?: string
      }
    }
    score: {
      final: number
    }
    searchScore: number
  }>
  total: number
  time: string
}

/**
 * GET /api/registry/dependents/:name
 *
 * Returns packages that depend on the given package,
 * using the npm search API with `dependencies:<name>` query.
 */
export default defineCachedEventHandler(
  async event => {
    const pkgSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const rawName = pkgSegments.join('/')
    const packageName = decodeURIComponent(rawName)

    const query = getQuery(event)
    const page = Math.max(0, Number(query.page ?? 0))
    const size = Math.min(50, Math.max(1, Number(query.size ?? 20)))
    const from = page * size

    if (!packageName) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    try {
      const data = await $fetch<NpmSearchResult>(NPM_SEARCH_BASE, {
        query: {
          text: `dependencies:${packageName}`,
          size,
          from,
        },
      })

      return {
        total: data.total,
        page,
        size,
        packages: data.objects.map(obj => ({
          name: obj.package.name,
          version: obj.package.version,
          description: obj.package.description ?? null,
          date: obj.package.date ?? null,
          score: obj.score.final,
        })),
      }
    } catch {
      return {
        total: 0,
        page,
        size,
        packages: [],
      }
    }
  },
  {
    maxAge: CACHE_MAX_AGE_FIVE_MINUTES,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      const query = getQuery(event)
      return `dependents:v1:${pkg}:p${query.page ?? 0}:s${query.size ?? 20}`
    },
  },
)
