import { resolveURL } from 'ufo'
import * as v from 'valibot'
import { getBaseFileUrl } from '~~/server/utils/changelog/baseFileUrl'
import {
  createForgejoRepoInfo,
  createGithubRepoInfo,
  createGitLabRepoInfo,
  createTangledInfo,
} from '~~/server/utils/changelog/mdRepoInfo'
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
      const baseUrl = getBaseFileUrl({
        owner,
        provider: provider as ProviderId,
        repo,
        host,
      })
      const mdRepoInfo = getRepoInfo(provider, owner, repo, host, path)

      if (!baseUrl || !mdRepoInfo) {
        throw createError({
          status: 404,
          statusMessage: ERROR_CHANGELOG_NOT_FOUND,
        })
      }
      const data = await $fetch(resolveURL(baseUrl.raw, path), {
        headers: {
          'User-Agent': 'npmx.dev',
        },
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

function getRepoInfo(
  provider: ProviderId,
  owner: string,
  repo: string,
  host: string | undefined,
  path?: string,
) {
  switch (provider) {
    case 'github':
      return createGithubRepoInfo(owner, repo, path)
    case 'codeberg':
      return createForgejoRepoInfo('codeberg.org', owner, repo, path)
    case 'forgejo':
      return createForgejoRepoInfo(host ?? 'codeberg.org', owner, repo, path)
    case 'gitlab':
      return createGitLabRepoInfo(host ?? 'gitlab.com', owner, repo, path)
    case 'tangled':
      return createTangledInfo(owner, repo, path)
  }
}
