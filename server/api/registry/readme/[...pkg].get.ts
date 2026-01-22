export default defineCachedEventHandler(
  async (event) => {
    const pkg = getRouterParam(event, 'pkg')
    if (!pkg) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    const packageName = pkg.replace(/\//g, '/')

    try {
      const packageData = await fetchNpmPackage(packageName)

      if (!packageData.readme || packageData.readme === 'ERROR: No README data found!') {
        return { html: '' }
      }

      const html = renderReadmeHtml(packageData.readme, packageName)
      return { html }
    }
    catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({ statusCode: 502, message: 'Failed to fetch package from npm registry' })
    }
  },
  {
    maxAge: 60 * 10,
    getKey: event => `readme:${getRouterParam(event, 'pkg') ?? ''}`,
  },
)
