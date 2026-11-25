import { validPackageParams } from '#server/utils/package-params'

export default defineEventHandler(async event => {
  const { packageName } = validPackageParams(event, {
    packageName: getRouterParam(event, 'pkg'),
  })

  const likesUtil = new PackageLikesUtils()
  return await likesUtil.getLikesEvolution(packageName)
})
