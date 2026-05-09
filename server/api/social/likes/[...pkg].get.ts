import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { PACKAGE_SUBJECT_REF } from '#shared/utils/constants'
import { getTopLikedRank } from '#server/utils/likes-leaderboard'

/**
 * GET /api/social/likes/:name
 *
 * Gets the likes for a npm package on npmx
 */
export default eventHandlerWithOAuthSession(async (event, oAuthSession, _) => {
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
    const [likes, topLikedRank] = await Promise.all([
      likesUtil.getLikes(packageName, oAuthSession?.did.toString()),
      getTopLikedRank(event, PACKAGE_SUBJECT_REF(packageName)),
    ])

    return {
      ...likes,
      topLikedRank,
    }
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: 'Failed to get likes',
    })
  }
})
