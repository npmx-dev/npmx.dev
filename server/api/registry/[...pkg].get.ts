export default defineCachedEventHandler(
  async (event) => {
    const pkg = getRouterParam(event, 'pkg')
    if (!pkg) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    const packageName = pkg.replace(/\//g, '/')

    try {
      return await fetchNpmPackage(packageName)
    }
    catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 502, message: 'Failed to fetch package from npm registry' })
    }
  },
  {
    maxAge: 60 * 5,
    getKey: event => getRouterParam(event, 'pkg') ?? '',
  },
)
