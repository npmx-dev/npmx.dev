import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { createError, getRouterParam } from 'nuxt/server'
import { defineCachedEventHandler } from '#server/utils/cached-handler'
import { $fetch } from 'ofetch'
import type { NpmAttestationsResponse } from '#server/utils/provenance'

/**
 * GET /api/registry/provenance/:name/v/:version
 *
 * Returns parsed provenance details for a package version (build summary, source commit, build file, public ledger).
 * Version is required. Returns null when the version has no attestations or parsing fails.
 */
export default defineCachedEventHandler(
  async event => {
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    if (!rawVersion) {
      throw createError({
        status: 400,
        message: 'Version is required for provenance.',
      })
    }

    try {
      const parsed = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      }) as { packageName: string; version: string }
      const { packageName, version } = parsed

      const packument = await fetchNpmPackageAbbreviated(packageName)
      const versionData = packument.versions[version]
      if (!versionData) {
        throw createError({
          status: 404,
          message: `Version ${version} not found for package ${packageName}.`,
        })
      }
      const dist = versionData.dist as NpmVersionDist | undefined
      const attestationsUrl = dist?.attestations?.url

      if (!attestationsUrl) {
        return null
      }

      const response = await $fetch<NpmAttestationsResponse>(attestationsUrl)
      const details = parseAttestationToProvenanceDetails(response)
      return details
    } catch (error: unknown) {
      handleApiError(error, {
        status: 502,
        message: ERROR_PROVENANCE_FETCH_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `provenance:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
