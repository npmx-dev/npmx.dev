import type { RequestEvent } from 'nuxt/server'
import { ERROR_NPM_FETCH_FAILED } from '#shared/utils/constants'
import { resolvePackageReadmeSource } from '#server/utils/readme-loaders'
import { getRouterParam } from 'nuxt/server'

export default async function getMarkdownReadme(event: RequestEvent) {
  try {
    const packagePath = getRouterParam(event, 'pkg') ?? ''
    return await resolvePackageReadmeSource(packagePath)
  } catch (error: unknown) {
    handleApiError(error, {
      status: 502,
      message: ERROR_NPM_FETCH_FAILED,
    })
  }
}
