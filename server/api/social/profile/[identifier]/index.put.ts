import { parse } from 'valibot'
import { Client } from '@atproto/lex'
import * as dev from '#shared/types/lexicons/dev'
import type { NPMXProfile } from '#shared/types/social'
import { ProfileEditBodySchema } from '#shared/schemas/social'

export default eventHandlerWithOAuthSession(async (event, oAuthSession) => {
  const loggedInUsersDid = oAuthSession?.did.toString()

  if (!oAuthSession || !loggedInUsersDid) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  await throwOnMissingOAuthScope(oAuthSession, PROFILE_SCOPE)

  const requestBody = await readBody(event)
  if (requestBody.website && !URL.canParse(requestBody.website)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid website' })
  }

  const body = parse(ProfileEditBodySchema, requestBody)
  const client = new Client(oAuthSession)

  const profile = dev.npmx.actor.profile.$build({
    displayName: body.displayName,
    ...(body.description
      ? {
          description: body.description,
        }
      : {}),
    ...(body.website
      ? {
          website: body.website as `${string}:${string}`,
        }
      : {}),
  })

  const result = await client.put(dev.npmx.actor.profile, profile, { rkey: 'self' })
  if (!result) {
    throw createError({
      status: 500,
      message: 'Failed to update the profile',
    })
  }

  const profileUtil = new ProfileUtils()
  await profileUtil.updateProfileCache(loggedInUsersDid, body as NPMXProfile)

  return result.validationStatus
})
