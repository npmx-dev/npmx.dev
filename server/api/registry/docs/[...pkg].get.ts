import type { DocsResponse } from '#shared/types'
import { assertValidPackageName } from '#shared/utils/npm'
import { parsePackageParam } from '#shared/utils/parse-package-param'
import { generateDocsWithDeno, getEntrypoints } from '#server/utils/docs'

export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }

    const { packageName, version, rest } = parsePackageParam(pkgParam)

    if (!packageName) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package name is required' })
    }
    assertValidPackageName(packageName)

    if (!version) {
      // TODO: throwing 404 rather than 400 as it's cacheable
      throw createError({ statusCode: 404, message: 'Package version is required' })
    }

    // Extract entrypoint from remaining path segments (e.g., ["router.js"] -> "router.js")
    const entrypoint = rest.length > 0 ? rest.join('/') : undefined

    // Discover available entrypoints (null for single-entrypoint packages)
    const entrypoints = await getEntrypoints(packageName, version)

    // If multi-entrypoint but no specific entrypoint requested, return early
    // with the entrypoints list so the client can redirect to the first one
    if (entrypoints && !entrypoint) {
      return {
        package: packageName,
        version,
        html: '',
        toc: null,
        status: 'ok',
        entrypoints,
        entrypoint: entrypoints[0],
      } satisfies DocsResponse
    }

    let generated
    try {
      generated = await generateDocsWithDeno(packageName, version, entrypoint)
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Doc generation failed for ${packageName}@${version}:`, error)
      return {
        package: packageName,
        version,
        html: '',
        toc: null,
        status: 'error',
        message: 'Failed to generate documentation. Please try again later.',
        ...(entrypoints && { entrypoints, entrypoint }),
      } satisfies DocsResponse
    }

    if (!generated) {
      return {
        package: packageName,
        version,
        html: '',
        toc: null,
        status: 'missing',
        message: 'Docs are not available for this package. It may not have TypeScript types.',
        ...(entrypoints && { entrypoints, entrypoint }),
      } satisfies DocsResponse
    }

    return {
      package: packageName,
      version,
      html: generated.html,
      toc: generated.toc,
      status: 'ok',
      ...(entrypoints && { entrypoints, entrypoint }),
    } satisfies DocsResponse
  },
  {
    maxAge: 60 * 60, // 1 hour cache
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `docs:v3:${pkg}`
    },
  },
)
