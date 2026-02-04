export default eventHandlerWithOAuthSession(async (event, oAuthSession, _) => {
  const packageName = getRouterParam(event, 'pkg')
  if (!packageName) {
    throw createError({
      status: 400,
      message: 'package name not provided',
    })
  }

  const likesUtil = new PackageLikesUtils()
  return await likesUtil.getLikes(packageName, oAuthSession?.did.toString())
})
