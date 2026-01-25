export default defineCachedEventHandler(
  async event => {
    const pkg = getRouterParam(event, 'pkg')
    if (!pkg) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    assertValidPackageName(pkg)

    try {
      return await fetchNpmPackage(pkg)
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 502, message: 'Failed to fetch package from npm registry' })
    }
  },
  {
    maxAge: 60 * 60, // 1 hour
    swr: true,
    getKey: event => getRouterParam(event, 'pkg') ?? '',
  },
)
