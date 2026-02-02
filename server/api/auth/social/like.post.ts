import { Client } from '@atproto/lex'
// import { main as likeRecord } from '#shared/types/lexicons/dev/npmx/feed/like.defs'
import * as dev from '#shared/types/lexicons/dev'
import type { UriString } from '@atproto/lex'
import { ERROR_NEED_REAUTH, LIKES_SCOPE } from '~~/shared/utils/constants'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  const loggedInUsersDid = oAuthSession?.did.toString()

  if (!oAuthSession || !loggedInUsersDid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const body = await readBody<{ packageName: string }>(event)

  if (!body.packageName) {
    throw createError({
      status: 400,
      message: 'packageName is required',
    })
  }

  const cachedFetch = event.context.cachedFetch
  if (!cachedFetch) {
    // TODO: Probably needs to add in a normal fetch if not provided
    // but ideally should not happen
    throw createError({
      status: 500,
      message: 'cachedFetch not provided in context',
    })
  }

  const likesUtil = new PackageLikesUtils(cachedFetch)

  const hasLiked = await likesUtil.hasTheUserLikedThePackage(body.packageName, loggedInUsersDid)
  if (hasLiked) {
    throw createError({
      status: 400,
      message: 'User has already liked the package',
    })
  }

  //Checks if the user has a scope to like packages
  const tokenInfo = await oAuthSession.getTokenInfo()
  if (!tokenInfo.scope.includes(LIKES_SCOPE)) {
    throw createError({
      status: 403,
      message: ERROR_NEED_REAUTH,
    })
  }

  const subjectRef = PACKAGE_SUBJECT_REF(body.packageName)
  const client = new Client(oAuthSession)

  const like = dev.npmx.feed.like.$build({
    createdAt: new Date().toISOString(),
    //TODO test this?
    subjectRef: subjectRef as UriString,
  })

  const result = await client.create(dev.npmx.feed.like, like)
  if (!result) {
    throw createError({
      status: 500,
      message: 'Failed to create like',
    })
  }

  return await likesUtil.likeAPackageAndRetunLikes(body.packageName, loggedInUsersDid)
})
