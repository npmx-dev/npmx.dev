export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const { packageName, version } = parsePackageParam(pkgParam)

    if (!packageName) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }
    assertValidPackageName(packageName)

    if (!version) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package version is required' })
    }

    let markdown
    try {
      markdown = await generateDocsMarkdownWithDeno(packageName, version)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Markdown doc generation failed for ${packageName}@${version}:`, error)
      throw createError({
        statusCode: 502,
        message: 'Failed to generate documentation. Please try again later.',
      })
    }

    if (!markdown) {
      throw createError({
        statusCode: 404,
        message: 'Docs are not available for this package. It may not have TypeScript types.',
      })
    }

    return {
      package: packageName,
      version,
      markdown,
    } satisfies DocsMarkdownResponse
  },
  {
    maxAge: 60 * 60, // 1 hour cache
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `docs-markdown:v1:${pkg}`
    },
  },
)
