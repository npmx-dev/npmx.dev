import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import type {
  PackageAnalysis,
  ExtendedPackageJson,
  CreatePackageInfo,
} from '#shared/utils/package-analysis'
import { analyzePackage, getCreatePackageName } from '#shared/utils/package-analysis'
import {
  getDevDependencySuggestion,
  type DevDependencySuggestion,
} from '#shared/utils/dev-dependency'
import {
  NPM_REGISTRY,
  CACHE_MAX_AGE_ONE_DAY,
  ERROR_PACKAGE_ANALYSIS_FAILED,
} from '#shared/utils/constants'
import { parseRepositoryInfo } from '#shared/utils/git-providers'
import { encodePackageName } from '#shared/utils/npm'
import { fetchPackageWithTypesAndFiles } from '#server/utils/file-tree'
import { getLatestVersionBatch } from 'fast-npm-meta'

export default defineCachedEventHandler(
  async event => {
    // Parse package name and optional version from path
    // e.g., "vue" or "vue/v/3.4.0" or "@nuxt/kit" or "@nuxt/kit/v/1.0.0"
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version } = v.parse(PackageRouteParamsSchema, {
        packageName: decodeURIComponent(rawPackageName),
        version: rawVersion,
      })
      const { pkg, typesPackage, files } = await fetchPackageWithTypesAndFiles(packageName, version)
      const createPackage = await findAssociatedCreatePackage(packageName, pkg)
      const analysis = analyzePackage(pkg, {
        typesPackage,
        createPackage,
        files,
      })
      const devDependencySuggestion = getDevDependencySuggestion(packageName, pkg.readme)

      return {
        package: packageName,
        version: pkg.version ?? version ?? 'latest',
        devDependencySuggestion,
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
      return `analysis:v2:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)

/** Package metadata needed for association validation */
interface PackageWithMeta {
  maintainers?: Array<{ name: string }>
  repository?: { url?: string } | string
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
  basePkg: { maintainers?: Array<{ name: string }>; repository?: { url?: string } | string },
  createPkg: { maintainers?: Array<{ name: string }>; repository?: { url?: string } | string },
): boolean {
  const baseMaintainers = new Set(basePkg.maintainers?.map(m => m.name.toLowerCase()) ?? [])
  const createMaintainers = createPkg.maintainers?.map(m => m.name.toLowerCase()) ?? []
  const hasSharedMaintainer = createMaintainers.some(name => baseMaintainers.has(name))

  return hasSharedMaintainer || hasSameRepositoryOwner(basePkg.repository, createPkg.repository)
}

/**
 * Check if two repository URLs have the same owner (works with any git provider).
 */
function hasSameRepositoryOwner(
  baseRepo: string | { url?: string } | undefined,
  createRepo: string | { url?: string } | undefined,
): boolean {
  if (!baseRepo || !createRepo) return false

  const baseRef = parseRepositoryInfo(baseRepo)
  const createRef = parseRepositoryInfo(createRepo)

  if (!baseRef || !createRef) return false
  if (baseRef.provider !== createRef.provider) return false
  if (baseRef.host && createRef.host && baseRef.host !== createRef.host) return false

  return baseRef.owner.toLowerCase() === createRef.owner.toLowerCase()
}

export interface PackageAnalysisResponse extends PackageAnalysis {
  package: string
  version: string
  devDependencySuggestion: DevDependencySuggestion
}
