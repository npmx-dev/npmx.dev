import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import type { PackageAnalysis, ExtendedPackageJson } from '#shared/utils/package-analysis'
import {
  analyzePackage,
  getTypesPackageName,
  hasBuiltInTypes,
} from '#shared/utils/package-analysis'
import {
  NPM_REGISTRY,
  CACHE_MAX_AGE_ONE_DAY,
  ERROR_PACKAGE_ANALYSIS_FAILED,
} from '#shared/utils/constants'

export default defineCachedEventHandler(
  async event => {
    // Parse package name and optional version from path
    // e.g., "vue" or "vue/v/3.4.0" or "@nuxt/kit" or "@nuxt/kit/v/1.0.0"
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      // Fetch package data
      const encodedName = encodePackageName(packageName)
      const versionSuffix = version ? `/${version}` : '/latest'
      const pkg = await $fetch<ExtendedPackageJson>(
        `${NPM_REGISTRY}/${encodedName}${versionSuffix}`,
      )

      // Only check for @types package if the package doesn't ship its own types
      let typesPackageExists = false
      if (!hasBuiltInTypes(pkg)) {
        const typesPkgName = getTypesPackageName(packageName)
        typesPackageExists = await checkPackageExists(typesPkgName)
      }

      const analysis = analyzePackage(pkg, { typesPackageExists })

      return {
        package: packageName,
        version: pkg.version ?? version ?? 'latest',
        ...analysis,
      } satisfies PackageAnalysisResponse
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_PACKAGE_ANALYSIS_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY, // 24 hours - analysis rarely changes
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `analysis:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
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
