import * as v from 'valibot'
import { getFileUrls } from '~~/server/utils/changelog/baseFileUrl'
import { createRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'
import {
  ERROR_CHANGELOG_FILE_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    const owner = getRouterParam(event, 'owner')
    const path = getRouterParam(event, 'path')

    const rawQuery = getQuery(event)

    const { host, raw } = v.parse(
      v.object({
        host: validateHostWithValibot(provider),
        raw: v.optional(v.string()),
      }),
      rawQuery,
    )

    if (!repo || !provider || !owner || !path) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }

    try {
      const ref = { provider: provider as ProviderId, owner, repo, host }
      const urls = getFileUrls(ref, path)
      const mdRepoInfo = createRepoInfo(ref, path)

      if (!urls || !mdRepoInfo) {
        throw createError({
          status: 404,
          statusMessage: ERROR_CHANGELOG_NOT_FOUND,
        })
      }
      const data = await $fetch(urls.raw, {
        headers: {
          'User-Agent': 'npmx.dev',
        },
        timeout: 15_000,
      })
      const markdown = v.parse(v.string(), data)
      if (raw != undefined) {
        setHeader(event, 'content-type', 'text/markdown')
        return markdown
      }
      return (await changelogRenderer(mdRepoInfo))(markdown)
    } catch (error) {
      handleApiError(error, {
        statusCode: 500,
        message: ERROR_CHANGELOG_FILE_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR * 2, // 2 hours
    swr: true,
    getKey: event => {
      const provider = getRouterParam(event, 'provider') ?? ''
      const repo = getRouterParam(event, 'repo') ?? ''
      const owner = getRouterParam(event, 'owner') ?? ''
      const path = getRouterParam(event, 'path') ?? ''

      const query = getQuery(event)

      const key = [`changelogMarkdown:v2:${provider}:${owner}:${repo}:${path.replaceAll('/', ':')}`]

      if (typeof query.host === 'string') {
        key.push(query.host)
      }
      if ('raw' in query) {
        key.push('raw')
      }

      return key.join(':')
    },
    shouldBypassCache: () => import.meta.dev,
  },
)
