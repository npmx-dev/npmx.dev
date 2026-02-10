export default defineEventHandler(async event => {
  const packageName = getRouterParam(event, 'pkg')
  if (!packageName) {
    throw createError({
      status: 400,
      message: 'package name not provided',
    })
  }

  const likesUtil = new PackageLikesUtils()
  return await likesUtil.getLikesEvolution(packageName)
})
