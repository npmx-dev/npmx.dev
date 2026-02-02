import * as v from 'valibot'
import { Client } from '@atproto/lex'
import * as dev from '#shared/types/lexicons/dev'
import { PackageLikeBodySchema } from '#shared/schemas/social'
import { throwOnMissingOAuthScope } from '#server/utils/atproto/oauth'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  const loggedInUsersDid = oAuthSession?.did.toString()

  if (!oAuthSession || !loggedInUsersDid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  //Checks if the user has a scope to like packages
  await throwOnMissingOAuthScope(oAuthSession, LIKES_SCOPE)

  const body = v.parse(PackageLikeBodySchema, await readBody(event))

  const likesUtil = new PackageLikesUtils()

  const getTheUsersLikedRecord = await likesUtil.getTheUsersLikedRecord(
    body.packageName,
    loggedInUsersDid,
  )

  if (getTheUsersLikedRecord) {
    const client = new Client(oAuthSession)

    await client.delete(dev.npmx.feed.like, {
      rkey: getTheUsersLikedRecord.rkey,
    })
    var result = await likesUtil.unlikeAPackageAndReturnLikes(body.packageName, loggedInUsersDid)
    return result
  }

  console.error(
    `User ${loggedInUsersDid} tried to unlike a package ${body.packageName} but it was not liked by them.`,
  )
})
