import type { ExtendedPackageJson } from '#shared/utils/package-analysis'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import {
  ERROR_PACKAGE_HAS_CHANGELOG,
  NPM_REGISTRY,
  CACHE_MAX_AGE_ONE_DAY,
} from '#shared/utils/constants'
import * as v from 'valibot'
import { detectHasChangelog } from '~~/server/utils/has-changelog'

export default defineCachedEventHandler(
  async event => {
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []

    const { rawPackageName, rawVersion } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName, version } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      const encodedName = encodePackageName(packageName)
      const versionSuffix = version ? `/${version}` : '/latest'
      const pkg = await $fetch<ExtendedPackageJson>(
        `${NPM_REGISTRY}/${encodedName}${versionSuffix}`,
      )

      return await detectHasChangelog(pkg)
    } catch (error) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_PACKAGE_HAS_CHANGELOG,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY, // 24 hours - analysis rarely changes
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `changelog:v1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
