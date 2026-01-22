async function fetchReadmeFromJsdelivr(packageName: string): Promise<string | null> {
  // Try common README filenames
  const filenames = ['README.md', 'readme.md', 'Readme.md', 'README', 'readme']

  for (const filename of filenames) {
    try {
      const url = `https://cdn.jsdelivr.net/npm/${packageName}/${filename}`
      const response = await fetch(url)
      if (response.ok) {
        return await response.text()
      }
    }
    catch {
      // Try next filename
    }
  }

  return null
}

export default defineCachedEventHandler(
  async (event) => {
    const pkg = getRouterParam(event, 'pkg')
    if (!pkg) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    const packageName = pkg.replace(/\//g, '/')

    try {
      const packageData = await fetchNpmPackage(packageName)

      let readmeContent = packageData.readme

      // If no README in packument, try fetching from jsdelivr (package tarball)
      if (!readmeContent || readmeContent === 'ERROR: No README data found!') {
        readmeContent = await fetchReadmeFromJsdelivr(packageName) ?? undefined
      }

      if (!readmeContent) {
        return { html: '' }
      }

      const html = await renderReadmeHtml(readmeContent, packageName)
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
