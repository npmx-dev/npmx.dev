import type { DocsResponse } from '#shared/types'
import { fetchNpmPackage } from '#server/utils/npm'
import { assertValidPackageName } from '#shared/utils/npm'
import { generateDocsWithDeno } from '#server/utils/docs'

export default defineCachedEventHandler(
  async (event) => {
    const segments = getRouterParam(event, 'pkg')?.split('/') ?? []
    if (segments.length === 0) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    // Parse package name and optional version from URL segments
    // Patterns: [pkg] or [pkg, 'v', version] or [@scope, pkg] or [@scope, pkg, 'v', version]
    let packageName: string
    let version: string | undefined

    const vIndex = segments.indexOf('v')
    if (vIndex !== -1 && vIndex < segments.length - 1) {
      packageName = segments.slice(0, vIndex).join('/')
      version = segments.slice(vIndex + 1).join('/')
    }
    else {
      packageName = segments.join('/')
    }

    if (!packageName) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }
    assertValidPackageName(packageName)

    const packument = await fetchNpmPackage(packageName)

    if (!version) {
      version = packument['dist-tags']?.latest
    }

    if (!version) {
      throw createError({ statusCode: 404, message: 'No latest version found' })
    }

    try {
      const generated = await generateDocsWithDeno(packageName, version)

      if (!generated) {
        return {
          package: packageName,
          version,
          html: '',
          toc: null,
          breadcrumbs: null,
          status: 'missing',
          message: 'Docs are not available for this package. It may not have TypeScript types.',
        } satisfies DocsResponse
      }

      return {
        package: packageName,
        version,
        html: generated.html,
        toc: generated.toc,
        breadcrumbs: null,
        status: 'ok',
      } satisfies DocsResponse
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error(`[docs] Error generating docs for ${packageName}@${version}:`, message)

      return {
        package: packageName,
        version,
        html: '',
        toc: null,
        breadcrumbs: null,
        status: 'error',
        message: 'Failed to generate docs. The package may not export TypeScript types.',
      } satisfies DocsResponse
    }
  },
  {
    maxAge: 60 * 60, // 1 hour cache
    swr: true,
    getKey: (event) => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `docs:v5:${pkg}`
    },
  },
)
