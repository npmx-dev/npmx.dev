import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import type {
  PackageAnalysis,
  ExtendedPackageJson,
  TypesPackageInfo,
  CreatePackageInfo,
} from '#shared/utils/package-analysis'
import {
  analyzePackage,
  getTypesPackageName,
  getCreatePackageName,
  hasBuiltInTypes,
} from '#shared/utils/package-analysis'
import {
  NPM_REGISTRY,
  CACHE_MAX_AGE_ONE_DAY,
  ERROR_PACKAGE_ANALYSIS_FAILED,
} from '#shared/utils/constants'
import { parseRepoUrl } from '#shared/utils/git-providers'
import { getLatestVersion, getLatestVersionBatch } from 'fast-npm-meta'

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

      // Check for associated create-* package (e.g., vite -> create-vite, next -> create-next-app)
      // Only show if the packages are actually associated (same maintainers or same org)
      const createPackage = await findAssociatedCreatePackage(packageName, pkg)

      const analysis = analyzePackage(pkg, { typesPackage, createPackage })
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
 * Fetch @types package info including deprecation status using fast-npm-meta.
 * Returns undefined if the package doesn't exist.
 */
async function fetchTypesPackageInfo(packageName: string): Promise<TypesPackageInfo | undefined> {
  const result = await getLatestVersion(packageName, { metadata: true, throw: false })
  if ('error' in result) {
    return undefined
  }
  return {
    packageName,
    deprecated: result.deprecated,
  }
}

/** Package metadata needed for association validation */
interface PackageWithMeta {
  maintainers?: Array<{ name: string }>
  repository?: { url?: string }
  deprecated?: string
}

/**
 * Get all possible create-* package name patterns for a given package.
 * e.g., "next" -> ["create-next", "create-next-app"]
 * e.g., "@scope/foo" -> ["@scope/create-foo", "@scope/create-foo-app"]
 */
function getCreatePackageNameCandidates(packageName: string): string[] {
  const baseName = getCreatePackageName(packageName)
  return [baseName, `${baseName}-app`]
}

/**
 * Find an associated create-* package by trying multiple naming patterns using batch API.
 * Returns the first associated package found (preferring create-{name} over create-{name}-app).
 */
async function findAssociatedCreatePackage(
  packageName: string,
  basePkg: ExtendedPackageJson,
): Promise<CreatePackageInfo | undefined> {
  const candidates = getCreatePackageNameCandidates(packageName)

  // Use batch API to fetch all candidates in a single request
  const results = await getLatestVersionBatch(candidates, { metadata: true, throw: false })

  // Process results in order (first valid match wins)
  for (let i = 0; i < candidates.length; i++) {
    const result = results[i]
    const candidateName = candidates[i]
    if (!result || !candidateName || 'error' in result) continue

    // Need to fetch full package data for association validation (maintainers/repo)
    const createPkgInfo = await fetchCreatePackageForValidation(
      candidateName,
      basePkg,
      result.deprecated,
    )
    if (createPkgInfo) {
      return createPkgInfo
    }
  }

  return undefined
}

/**
 * Fetch create-* package metadata for association validation.
 * Returns CreatePackageInfo if the package is associated with the base package.
 */
async function fetchCreatePackageForValidation(
  createPkgName: string,
  basePkg: ExtendedPackageJson,
  deprecated: string | undefined,
): Promise<CreatePackageInfo | undefined> {
  try {
    const encodedName = encodePackageName(createPkgName)
    // Fetch /latest to get maintainers and repository for association validation
    const createPkg = await $fetch<PackageWithMeta>(`${NPM_REGISTRY}/${encodedName}/latest`)

    // Validate that the packages are actually associated
    if (!isAssociatedPackage(basePkg, createPkg)) {
      return undefined
    }

    return {
      packageName: createPkgName,
      deprecated,
    }
  } catch {
    return undefined
  }
}

/**
 * Check if two packages are associated (share maintainers or same repo owner).
 */
function isAssociatedPackage(
  basePkg: { maintainers?: Array<{ name: string }>; repository?: { url?: string } },
  createPkg: { maintainers?: Array<{ name: string }>; repository?: { url?: string } },
): boolean {
  const baseMaintainers = new Set(basePkg.maintainers?.map(m => m.name.toLowerCase()) ?? [])
  const createMaintainers = createPkg.maintainers?.map(m => m.name.toLowerCase()) ?? []
  const hasSharedMaintainer = createMaintainers.some(name => baseMaintainers.has(name))

  return (
    hasSharedMaintainer ||
    hasSameRepositoryOwner(basePkg.repository?.url, createPkg.repository?.url)
  )
}

/**
 * Check if two repository URLs have the same owner (works with any git provider).
 */
function hasSameRepositoryOwner(
  baseRepoUrl: string | undefined,
  createRepoUrl: string | undefined,
): boolean {
  if (!baseRepoUrl || !createRepoUrl) return false

  const baseRef = parseRepoUrl(baseRepoUrl)
  const createRef = parseRepoUrl(createRepoUrl)

  if (!baseRef || !createRef) return false
  if (baseRef.provider !== createRef.provider) return false
  if (baseRef.host && createRef.host && baseRef.host !== createRef.host) return false

  return baseRef.owner.toLowerCase() === createRef.owner.toLowerCase()
}

export interface PackageAnalysisResponse extends PackageAnalysis {
  package: string
  version: string
}
