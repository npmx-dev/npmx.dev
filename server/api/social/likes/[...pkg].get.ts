export default eventHandlerWithOAuthSession(async (event, oAuthSession, _) => {
  const packageName = getRouterParam(event, 'pkg')
  if (!packageName) {
    throw createError({
      status: 400,
      message: 'package name not provided',
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
  return await likesUtil.getLikes(packageName, oAuthSession?.did.toString())
})
