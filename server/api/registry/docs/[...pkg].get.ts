import type { DocsResponse } from '#shared/types'
import { fetchNpmPackage } from '#server/utils/npm'
import { assertValidPackageName } from '#shared/utils/npm'
import { parsePackageParam } from '#shared/utils/parse-package-param'
import { generateDocsWithDeno } from '#server/utils/docs'

export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    const { packageName, version: requestedVersion } = parsePackageParam(pkgParam)

    if (!packageName) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }
    assertValidPackageName(packageName)

    const packument = await fetchNpmPackage(packageName)
    const version = requestedVersion ?? packument['dist-tags']?.latest

    if (!version) {
      throw createError({ statusCode: 404, message: 'No latest version found' })
    }

    // Extract exports from the already-fetched packument to avoid redundant fetch
    const versionData = packument.versions?.[version]
    const exports = versionData?.exports as Record<string, unknown> | undefined

    let generated
    try {
      generated = await generateDocsWithDeno(packageName, version, exports)
    } catch (error) {
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
      return `docs:v1:${pkg}`
    },
  },
)
