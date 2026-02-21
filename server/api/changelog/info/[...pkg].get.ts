import type { ExtendedPackageJson } from '#shared/utils/package-analysis'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { ERROR_PACKAGE_DETECT_CHANGELOG, NPM_REGISTRY } from '#shared/utils/constants'
import * as v from 'valibot'
import { detectChangelog } from '~~/server/utils/changelog/detectChangelog'
// CACHE_MAX_AGE_ONE_DAY,

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

      return await detectChangelog(pkg)
    } catch (error) {
      handleApiError(error, {
        statusCode: 502,
        message: ERROR_PACKAGE_DETECT_CHANGELOG,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY, // 24 hours
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `changelogInfo:pr1:${pkg.replace(/\/+$/, '').trim()}`
    },
  },
)
