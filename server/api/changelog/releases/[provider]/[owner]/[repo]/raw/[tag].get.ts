import type { ProviderId, RepoRef } from '~~/shared/utils/git-providers'
import * as v from 'valibot'
import { ERROR_THROW_INCOMPLETE_PARAM } from '~~/shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'

const TIMEOUT_MS = 15_000

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    // A GitLab subgroup owner arrives encoded as one segment (`group%2Fsub`).
    const owner = getRouterParam(event, 'owner', { decode: true })
    let tag = getRouterParam(event, 'tag')

    const rawQuery = getQuery(event)
    const { host } = v.parse(v.object({ host: validateHostWithValibot(provider) }), rawQuery)

    if (!repo || !provider || !owner || !tag) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }
    // nuxt does decode a tag except for `/`
    tag = decodeURIComponent(tag)

    setHeader(event, 'content-type', 'text/markdown')

    try {
      // No disconnect signal: a cached handler cannot tell a client leaving from
      // an SWR revalidation, and aborting would kill the refresh for everyone.
      return await getMarkdownViaForges(provider, owner, repo, tag, host || undefined)
    } catch (error) {
      handleApiError(error, {
        statusCode: 500,
        message: ERROR_CHANGELOG_RELEASES_FAILED,
      })
    }
  },
  {
    getKey: event => {
      const provider = getRouterParam(event, 'provider')
      const repo = getRouterParam(event, 'repo')
      const owner = getRouterParam(event, 'owner')
      const tag = getRouterParam(event, 'tag')
      const key = [`changelogRaw:v1:${provider}:${owner}:${repo}:${tag}`]

      const query = getQuery(event)

      if (typeof query.host == 'string') {
        key.push(query.host)
      }
      return key.join(':')
    },
    shouldBypassCache: () => import.meta.dev,
  },
)

/** Release markdown for every provider `forges` covers. */
async function getMarkdownViaForges(
  provider: ProviderId,
  owner: string,
  repo: string,
  tag: string,
  host?: string,
) {
  const ref: RepoRef = { provider, owner, repo, host }
  const forgeProvider = await createForgeProvider(ref, { timeout: TIMEOUT_MS, viaProxy: true })
  if (!forgeProvider?.can('releases.getByTag')) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }

  const release = await forgeProvider.releases.getByTag(toForgeRepoRef(ref), tag)
  return release.body ?? ''
}
