import { getQuery, getRouterParam } from 'h3'
import { IdentityUtils } from '#server/utils/atproto/utils/identity'

export default defineEventHandler(async event => {
  const identifier = getRouterParam(event, 'identifier')
  if (!identifier) {
    throw createError({
      status: 400,
      message: 'identifier not provided',
    })
  }

  const query = getQuery(event)
  const cursor = typeof query.cursor === 'string' ? query.cursor : undefined
  const parsedLimit = typeof query.limit === 'string' ? Number(query.limit) : NaN
  const limit = Number.isNaN(parsedLimit) ? 20 : Math.min(Math.max(parsedLimit, 1), 100)

  const utils = new IdentityUtils()
  const minidoc = await utils.getMiniDoc(identifier)
  const likesUtil = new PackageLikesUtils()

  const likes = await likesUtil.getUserLikes(minidoc, limit, cursor ?? undefined)

  return {
    cursor: likes.cursor,
    likes: likes.records
      .map(record => record.value.subjectRef)
      .filter(url => typeof url === 'string'),
  }
})
