import type { DocsResponse } from '#shared/types'
import { assertValidPackageName } from '#shared/utils/npm'
import { parsePackageParam } from '#shared/utils/parse-package-param'
import { generateDocsWithDeno } from '#server/utils/docs'

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

    let generated
    try {
      generated = await generateDocsWithDeno(packageName, version)
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
      } satisfies DocsResponse
    }

    return {
      package: packageName,
      version,
      html: generated.html,
      toc: generated.toc,
      status: 'ok',
    } satisfies DocsResponse
  },
  {
    maxAge: 60 * 60, // 1 hour cache
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `docs:v2:${pkg}`
    },
  },
)
