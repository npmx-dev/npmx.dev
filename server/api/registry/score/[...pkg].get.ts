import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

const NPMS_API = 'https://api.npms.io/v2/package'

export interface NpmsScore {
  final: number
  detail: {
    quality: number
    popularity: number
    maintenance: number
  }
}

export default defineCachedEventHandler(
  async event => {
    const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
    const { rawPackageName } = parsePackageParams(pkgParamSegments)

    try {
      const { packageName } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
      })

      const response = await fetch(`${NPMS_API}/${encodeURIComponent(packageName)}`)

      if (!response.ok) {
        throw createError({ statusCode: response.status, message: 'Failed to fetch npms score' })
      }

      const data = await response.json()
      return data.score as NpmsScore
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to fetch package score from npms.io',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const pkg = getRouterParam(event, 'pkg') ?? ''
      return `npms-score:${pkg}`
    },
  },
)
