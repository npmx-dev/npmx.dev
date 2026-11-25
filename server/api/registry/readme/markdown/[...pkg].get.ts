import type { H3Event } from 'h3'
import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { parsePackageParam } from '#shared/utils/parse-package-param'
import { resolvePackageReadmeSource } from '#server/utils/readme-loaders'
import { validPackageParams } from '#server/utils/package-params'

export default async function getMarkdownReadme(event: H3Event) {
  const packagePath = getRouterParam(event, 'pkg') ?? ''
  validPackageParams(event, parsePackageParam(packagePath))

  try {
    return await resolvePackageReadmeSource(packagePath)
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_NPM_FETCH_FAILED,
    })
  }
}
