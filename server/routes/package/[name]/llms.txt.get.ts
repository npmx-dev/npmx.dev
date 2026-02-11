import * as v from 'valibot'
import { PackageRouteParamsSchema } from '#shared/schemas/package'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { handleApiError } from '#server/utils/error-handler'
import { handleLlmsTxt } from '#server/utils/llms-txt'

/**
 * Serves llms.txt for an npm package.
 *
 * Handles all URL shapes via re-exports:
 * - /package/:name/llms.txt
 * - /package/:org/:name/llms.txt
 * - /package/:name/v/:version/llms.txt
 * - /package/:org/:name/v/:version/llms.txt
 */
export default defineCachedEventHandler(
  async event => {
    const org = getRouterParam(event, 'org')
    const name = getRouterParam(event, 'name')
    const rawVersion = getRouterParam(event, 'version')
    if (!name) {
      throw createError({ statusCode: 404, message: 'Package name is required.' })
    }

    const rawPackageName = org ? `${org}/${name}` : name

    try {
      const { packageName, version } = v.parse(PackageRouteParamsSchema, {
        packageName: rawPackageName,
        version: rawVersion,
      })

      const content = await handleLlmsTxt(packageName, version)
      setHeader(event, 'Content-Type', 'text/markdown; charset=utf-8')
      return content
    } catch (error: unknown) {
      handleApiError(error, {
        statusCode: 502,
        message: 'Failed to generate llms.txt.',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    getKey: event => {
      const org = getRouterParam(event, 'org')
      const name = getRouterParam(event, 'name')
      const version = getRouterParam(event, 'version')
      const pkg = org ? `${org}/${name}` : name
      return version ? `llms-txt:${pkg}@${version}` : `llms-txt:${pkg}`
    },
  },
)
