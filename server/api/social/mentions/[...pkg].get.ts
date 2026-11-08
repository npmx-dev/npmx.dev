import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'

/**
 * GET /api/social/mentions/:name
 *
 * Gets the number of unique social posts that mention a npm package, capped at 99+
 */
export default defineEventHandler(async event => {
  const pkgParamSegments = getRouterParam(event, 'pkg')?.split('/') ?? []
  const { rawPackageName } = parsePackageParams(pkgParamSegments)

  if (!rawPackageName) {
    throw createError({
      status: 400,
      message: 'package name not provided',
    })
  }

  let decodedPackageName: string
  try {
    decodedPackageName = decodeURIComponent(rawPackageName)
  } catch {
    throw createError({
      status: 400,
      message: 'Invalid package name encoding',
    })
  }

  try {
    const { packageName } = v.parse(PackageRouteParamsSchema, {
      packageName: decodedPackageName,
    })

    const mentionsUtil = new PackageSocialMentionsUtils()
    const mentions = await mentionsUtil.getMentions(packageName)

    setHeader(
      event,
      'Cache-Control',
      `public, max-age=${CACHE_MAX_AGE_ONE_HOUR}, s-maxage=${CACHE_MAX_AGE_ONE_HOUR}`,
    )
    return mentions
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: 'Failed to get social mentions',
    })
  }
})
