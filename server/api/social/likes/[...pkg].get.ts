import type { PublicPackageLikes } from '#shared/types/social'
import { setResponseHeader } from 'h3'
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { packageSubjectRef } from '#shared/utils/constants'
import { getTopLikedRank } from '#server/utils/likes-leaderboard'

/**
 * GET /api/social/likes/:name
 *
 * Gets public like counts and leaderboard rank for an npm package.
 */
export default defineEventHandler(async (event): Promise<PublicPackageLikes> => {
  const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
  const { rawPackageName } = parsePackageParams(pkgParamSegments)

  if (!rawPackageName) {
    throw createError({
      status: 400,
      message: 'package name not provided',
    })
  }

  try {
    const { packageName } = v.parse(PackageRouteParamsSchema, {
      packageName: decodeURIComponent(rawPackageName),
    })

    const likesUtil = new PackageLikesUtils()
    const [totalLikes, topLikedRank] = await Promise.all([
      likesUtil.getTotalLikes(packageName),
      getTopLikedRank(event, packageSubjectRef(packageName)),
    ])

    setResponseHeader(
      event,
      'Cache-Control',
      'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    )

    return {
      totalLikes,
      topLikedRank,
    }
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: 'Failed to get likes',
    })
  }
})
