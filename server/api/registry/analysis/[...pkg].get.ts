import type { PackageAnalysis, ExtendedPackageJson } from '#shared/utils/package-analysis'
import {
  analyzePackage,
  getTypesPackageName,
  hasBuiltInTypes,
} from '#shared/utils/package-analysis'

const NPM_REGISTRY = 'https://registry.npmjs.org'

export default defineCachedEventHandler(
  async event => {
    const pkgParam = getRouterParam(event, 'pkg')
    if (!pkgParam) {
      throw createError({ statusCode: 400, message: 'Package name is required' })
    }

    // Parse package name and optional version from path
    // e.g., "vue" or "vue/v/3.4.0" or "@nuxt/kit" or "@nuxt/kit/v/1.0.0"
    const segments = pkgParam.split('/')
    let packageName: string
    let version: string | undefined

    const vIndex = segments.indexOf('v')
    if (vIndex !== -1 && vIndex < segments.length - 1) {
      packageName = segments.slice(0, vIndex).join('/')
      version = segments.slice(vIndex + 1).join('/')
    } else {
      packageName = segments.join('/')
    }

    try {
      // Fetch package data
      const encodedName = encodePackageName(packageName)
      const versionSuffix = version ? `/${version}` : '/latest'
      const pkg = await $fetch<ExtendedPackageJson>(
        `${NPM_REGISTRY}/${encodedName}${versionSuffix}`,
      )

      // Only check for @types package if the package doesn't ship its own types
      let typesPackageExists = false
      if (!hasBuiltInTypes(pkg)) {
        const typesPackageName = getTypesPackageName(packageName)
        typesPackageExists = await checkPackageExists(typesPackageName)
      }

      const analysis = analyzePackage(pkg, { typesPackageExists })

      return {
        package: packageName,
        version: pkg.version ?? version ?? 'latest',
        ...analysis,
      } satisfies PackageAnalysisResponse
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        throw error
      }
      throw createError({
        statusCode: 502,
        message: 'Failed to analyze package',
      })
    }
  },
  {
    maxAge: 60 * 60 * 24, // 24 hours - analysis rarely changes
    swr: true,
    getKey: event => getRouterParam(event, 'pkg') ?? '',
  },
)

function encodePackageName(name: string): string {
  if (name.startsWith('@')) {
    return `@${encodeURIComponent(name.slice(1))}`
  }
  return encodeURIComponent(name)
}

async function checkPackageExists(packageName: string): Promise<boolean> {
  try {
    const encodedName = encodePackageName(packageName)
    const response = await $fetch.raw(`${NPM_REGISTRY}/${encodedName}`, {
      method: 'HEAD',
    })
    return response.status === 200
  } catch {
    return false
  }
}

export interface PackageAnalysisResponse extends PackageAnalysis {
  package: string
  version: string
}
