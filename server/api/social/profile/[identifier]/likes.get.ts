import { IdentityUtils } from '#server/utils/atproto/utils/identity'

export default defineEventHandler(async event => {
  const identifier = getRouterParam(event, 'identifier')
  const utils = new IdentityUtils()
  const minidoc = await utils.getMiniDoc(identifier || '')
  const likesUtil = new PackageLikesUtils()

  return likesUtil.getUserLikes(minidoc)
})
