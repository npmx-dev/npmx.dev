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
  const limit =
    typeof query.limit === 'string' ? Math.min(Math.max(Number(query.limit), 1), 100) : 20

  const utils = new IdentityUtils()
  const minidoc = await utils.getMiniDoc(identifier)
  const likesUtil = new PackageLikesUtils()

  return likesUtil.getUserLikes(minidoc, limit, cursor)
})
