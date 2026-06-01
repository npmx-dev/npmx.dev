import type { ExtendedPackageJson } from '#shared/utils/package-analysis'
import { VersionSchema, PackageNameSchema } from '#shared/schemas/package'
import { ERROR_PACKAGE_DETECT_CHANGELOG, NPM_REGISTRY } from '#shared/utils/constants'
import * as v from 'valibot'
import { detectChangelog } from '~~/server/utils/changelog/detectChangelog'

function getChangelogRouteParams(event: Parameters<typeof getRouterParam>[0]) {
  const org = getRouterParam(event, 'org')
  const name = getRouterParam(event, 'name')
  const rawVersion = getRouterParam(event, 'version')
  const rawPackageName = org ? `${org}/${name}` : name

  return { rawVersion, rawPackageName }
}

// setting cache options
export const defaultChangelogCacheOptions: Parameters<typeof defineCachedEventHandler>[1] = {
  maxAge: CACHE_MAX_AGE_ONE_DAY, // 24 hours
  swr: true,
  getKey: event => {
    const { rawPackageName = '', rawVersion = 'latest' } = getChangelogRouteParams(event)
    return `changelogInfo:v1:${rawPackageName.trim().replaceAll('/', ':')}:${rawVersion.trim()}`
  },
  shouldBypassCache: () => import.meta.dev,
}

// handler
export default defineCachedEventHandler(async event => {
  const { rawPackageName, rawVersion } = getChangelogRouteParams(event)

  try {
    const packageName = v.parse(PackageNameSchema, rawPackageName)
    const version = v.parse(v.optional(VersionSchema), rawVersion)
    const encodedName = encodePackageName(packageName)
    const versionSuffix = version ? `/${version}` : '/latest'
    const pkg = await $fetch<ExtendedPackageJson>(`${NPM_REGISTRY}/${encodedName}${versionSuffix}`)

    return await detectChangelog(pkg)
  } catch (error) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_PACKAGE_DETECT_CHANGELOG,
    })
  }
}, defaultChangelogCacheOptions)
