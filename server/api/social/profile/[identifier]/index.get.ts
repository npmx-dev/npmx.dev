export default defineEventHandler(async event => {
  const identifier = getRouterParam(event, 'identifier')
  if (!identifier) {
    throw createError({
      status: 400,
      message: 'identifier not provided',
    })
  }

  const profileUtil = new ProfileUtils()
  const profile = await profileUtil.getProfile(identifier)
  console.log('ENDPOINT', { identifier, profile })
  return profile
})
