import * as v from 'valibot'
import { Client } from '@atproto/lex'
import * as dev from '#shared/types/lexicons/dev'
import type { UriString } from '@atproto/lex'
import { LIKES_SCOPE } from '#shared/utils/constants'
import { PackageLikeBodySchema } from '#shared/schemas/social'
import { throwOnMissingOAuthScope } from '~~/server/utils/atproto/oauth'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  const loggedInUsersDid = oAuthSession?.did.toString()

  if (!oAuthSession || !loggedInUsersDid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  //Checks if the user has a scope to like packages
  await throwOnMissingOAuthScope(oAuthSession, LIKES_SCOPE)

  const body = v.parse(PackageLikeBodySchema, await readBody(event))

  const likesUtil = new PackageLikesUtils()

  const hasLiked = await likesUtil.hasTheUserLikedThePackage(body.packageName, loggedInUsersDid)
  if (hasLiked) {
    throw createError({
      status: 400,
      message: 'User has already liked the package',
    })
  }

  const subjectRef = PACKAGE_SUBJECT_REF(body.packageName)
  const client = new Client(oAuthSession)

  const like = dev.npmx.feed.like.$build({
    createdAt: new Date().toISOString(),
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
