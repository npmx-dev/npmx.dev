import type { PackageLikeStatus } from '#shared/types/social'
import { setResponseHeader } from 'h3'
import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'

/**
 * GET /api/social/like-status/:name
 *
 * Gets the authenticated user's like status and current total likes for an npm package.
 */
export default eventHandlerWithOAuthSession(
  async (event, oAuthSession): Promise<PackageLikeStatus> => {
    setResponseHeader(event, 'Cache-Control', 'private, no-store')

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

      const loggedInUsersDid = oAuthSession?.did.toString()
      if (!loggedInUsersDid) {
        return {
          userHasLiked: false,
        }
      }

      const likesUtil = new PackageLikesUtils()
      const likes = await likesUtil.getLikes(packageName, loggedInUsersDid)

      return {
        userHasLiked: likes.userHasLiked,
        totalLikes: likes.totalLikes,
      }
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to get like status',
      })
    }
  },
)
