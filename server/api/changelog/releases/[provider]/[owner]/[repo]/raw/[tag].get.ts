import type { ProviderId, RepoRef } from '~~/shared/utils/git-providers'
import * as v from 'valibot'
import { ERROR_THROW_INCOMPLETE_PARAM } from '~~/shared/utils/constants'
import { GithubReleaseCollectionSchama } from '~~/shared/schemas/changelog/release'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'
import { requestSignal } from '~~/server/utils/requestSignal'

const TIMEOUT_TIME = 15_000

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    const owner = getRouterParam(event, 'owner')
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
      // GitHub is read from the API directly (with an ungh fallback) to stay
      // clear of rate limits; `forges` has no proxy, so it is not used here.
      // TODO(serhalp): refactor to use `forges` once it can read GitHub through ungh.
      if (provider === 'github') {
        return getMarkdownFromGithub(owner, repo, tag)
      }
      return await getMarkdownViaForges(
        provider,
        owner,
        repo,
        tag,
        host || undefined,
        requestSignal(event),
      )
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

async function getMarkdownFromGithub(owner: string, repo: string, tag: string) {
  // ungh has no endpoint to get a release by tag yet, so read it through
  // `forges` (which calls the GitHub API) and fall back to the ungh releases
  // list when GitHub refuses, most likely due to a rate limit.
  // https://github.com/unjs/ungh/pull/162
  const ref: RepoRef = { provider: 'github', owner, repo }
  const forgeProvider = createForgeProvider(ref, { timeout: TIMEOUT_TIME })

  if (forgeProvider?.can('releases.getByTag')) {
    try {
      const release = await forgeProvider.releases.getByTag(toForgeRepoRef(ref), tag)
      if (release.body) {
        return release.body
      }
    } catch {
      // fall back to ungh below
    }
  }

  const responseUngh = await $fetch(`https://ungh.cc/repos/${owner}/${repo}/releases`, {
    headers: {
      'Accept': '*/*',
      'User-Agent': 'npmx.dev',
    },
    timeout: TIMEOUT_TIME,
  })

  const { releases } = v.parse(GithubReleaseCollectionSchama, responseUngh)

  for (const release of releases) {
    if (release.tag == tag) {
      return release.markdown
    }
  }

  throw createError({
    status: 404,
    statusMessage: ERROR_CHANGELOG_NOT_FOUND,
  })
}

/** Release markdown for every provider `forges` covers. */
async function getMarkdownViaForges(
  provider: ProviderId,
  owner: string,
  repo: string,
  tag: string,
  host?: string,
  signal?: AbortSignal,
) {
  const ref: RepoRef = { provider, owner, repo, host }
  const forgeProvider = createForgeProvider(ref, { timeout: TIMEOUT_TIME })
  if (!forgeProvider?.can('releases.getByTag')) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }

  const release = await forgeProvider.releases.getByTag(toForgeRepoRef(ref), tag, { signal })
  return release.body ?? ''
}
