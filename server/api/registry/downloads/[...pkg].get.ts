export default defineCachedEventHandler(
  async (event) => {
    const pkg = getRouterParam(event, 'pkg')
    if (!pkg) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    const query = getQuery(event)
    const period = String(query.period ?? 'last-week')

    const validPeriods = ['last-day', 'last-week', 'last-month', 'last-year']
    if (!validPeriods.includes(period)) {
      throw createError({ statusCode: 400, message: 'Invalid period' })
    }

    const packageName = pkg.replace(/\//g, '/')

    try {
      return await fetchNpmDownloads(packageName, period)
    }
    catch {
      throw createError({ statusCode: 502, message: 'Failed to fetch download counts' })
    }
  },
  {
    maxAge: 60 * 60,
    getKey: (event) => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      const query = getQuery(event)
      return `${pkg}:${query.period ?? 'last-week'}`
    },
  },
)
