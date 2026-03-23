import type { UriString } from '@atproto/lex'
import { Client, toDatetimeString } from '@atproto/lex'
import * as v from 'valibot'
import { throwOnMissingOAuthScope } from '#server/utils/atproto/oauth'
import { PackageLikeBodySchema } from '#shared/schemas/social'
import * as dev from '#shared/types/lexicons/dev'
import { LIKES_SCOPE } from '#shared/utils/constants'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  const loggedInUsersDid = oAuthSession?.did.toString()

  if (!oAuthSession || !loggedInUsersDid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  //Checks if the user has a scope to like packages
  await throwOnMissingOAuthScope(oAuthSession, LIKES_SCOPE)

  const body = v.parse(PackageLikeBodySchema, await readBody(event))

  const likesUtil = new PackageLikesUtils()

  // Checks to see if the user has liked the package already
  const likesResult = await likesUtil.getLikes(body.packageName, loggedInUsersDid)
  if (likesResult.userHasLiked) {
    return likesResult
  }

  const subjectRef = PACKAGE_SUBJECT_REF(body.packageName)
  const client = new Client(oAuthSession)

  const like = dev.npmx.feed.like.$build({
    createdAt: toDatetimeString(new Date()),
    subjectRef: subjectRef as UriString,
  })

  const result = await client.create(dev.npmx.feed.like, like)
  if (!result) {
    throw createError({
      status: 500,
      message: 'Failed to create a like',
    })
  }

  return await likesUtil.likeAPackageAndReturnLikes(body.packageName, loggedInUsersDid, result.uri)
})
