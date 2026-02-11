import type { H3Event } from 'h3'
import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { resolvePackageReadmeSource } from '#server/utils/readme-loaders'

export default async function getMarkdownReadme(event: H3Event) {
  try {
    const packagePath = getRouterParam(event, 'pkg') ?? ''
    return await resolvePackageReadmeSource(packagePath)
  } catch (error: unknown) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_NPM_FETCH_FAILED,
    })
  }
}
