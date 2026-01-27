import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import type {
  PackageAnalysis,
  ExtendedPackageJson,
  TypesPackageInfo,
} from '#shared/utils/package-analysis'
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

/** Minimal packument data needed to check deprecation status */
interface MinimalPackument {
  'name': string
  'dist-tags'?: { latest?: string }
  'versions'?: Record<string, { deprecated?: string }>
}

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
      let typesPackage: TypesPackageInfo | undefined
      if (!hasBuiltInTypes(pkg)) {
        const typesPkgName = getTypesPackageName(packageName)
        typesPackage = await fetchTypesPackageInfo(typesPkgName)
      }

      const analysis = analyzePackage(pkg, { typesPackage })

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

/**
 * Fetch @types package info including deprecation status.
 * Returns undefined if the package doesn't exist.
 */
async function fetchTypesPackageInfo(packageName: string): Promise<TypesPackageInfo | undefined> {
  try {
    const encodedName = encodePackageName(packageName)
    // Fetch abbreviated packument to check latest version's deprecation status
    const packument = await $fetch<MinimalPackument>(`${NPM_REGISTRY}/${encodedName}`, {
      headers: {
        // Request abbreviated packument to reduce payload
        Accept: 'application/vnd.npm.install-v1+json',
      },
    })

    // Get the latest version's deprecation message if any
    const latestVersion = packument['dist-tags']?.latest
    const deprecated = latestVersion ? packument.versions?.[latestVersion]?.deprecated : undefined

    return {
      packageName,
      deprecated,
    }
  } catch {
    return undefined
  }
}

export interface PackageAnalysisResponse extends PackageAnalysis {
  package: string
  version: string
}
