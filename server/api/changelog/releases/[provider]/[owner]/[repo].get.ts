import type { ProviderId, RepoRef } from '~~/shared/utils/git-providers'
import type { ReleaseData } from '~~/shared/types/changelog'
import * as v from 'valibot'
import {
  ERROR_CHANGELOG_RELEASES_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'
import { GithubReleaseCollectionSchama } from '~~/shared/schemas/changelog/release'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { changelogRenderer } from '~~/server/utils/changelog/markdown'
import { createRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'

const TIMEOUT_TIME = 15_000

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    // A GitLab subgroup owner arrives encoded as one segment (`group%2Fsub`).
    const owner = getRouterParam(event, 'owner', { decode: true })

    if (!repo || !provider || !owner) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }
    const rawQuery = getQuery(event)
    const { host } = v.parse(v.object({ host: validateHostWithValibot(provider) }), rawQuery)

    try {
      // GitHub is read through ungh.cc to stay clear of its anonymous rate limits;
      // TODO(serhalp): use `forges` once it can read GitHub through ungh.
      if (provider === 'github') {
        return await getReleasesFromGithub(owner, repo)
      }
      // No disconnect signal: a cached handler cannot tell a client leaving from
      // an SWR revalidation, and aborting would kill the refresh for everyone.
      return await getReleasesViaForges(provider, owner, repo, host || undefined)
    } catch (error) {
      handleApiError(error, {
        statusCode: 500,
        message: ERROR_CHANGELOG_RELEASES_FAILED,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR * 2, // 2 hours
    swr: true,
    getKey: event => {
      const provider = getRouterParam(event, 'provider')
      const repo = getRouterParam(event, 'repo')
      const owner = getRouterParam(event, 'owner')
      const key = [`changelogRelease:v2:${provider}:${owner}:${repo}`]

      const query = getQuery(event)

      if (typeof query.host == 'string') {
        key.push(query.host)
      }
      return key.join(':')
    },
    shouldBypassCache: () => import.meta.dev,
  },
)

async function getReleasesFromGithub(owner: string, repo: string) {
  const data = await $fetch(`https://ungh.cc/repos/${owner}/${repo}/releases`, {
    headers: {
      'Accept': '*/*',
      'User-Agent': 'npmx.dev',
    },
    timeout: TIMEOUT_TIME,
  })

  const { releases } = v.parse(GithubReleaseCollectionSchama, data)

  const repoInfo = createRepoInfo({ provider: 'github', owner, repo })
  if (!repoInfo) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }
  const render = await changelogRenderer(repoInfo)

  return releases.map(r => {
    const { html, toc } = render(r.markdown, r.id)
    return {
      id: r.id,
      // replace single \n within <p> like with Vue's releases
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: r.name || r.tag,
      draft: r.draft,
      prerelease: r.prerelease,
      toc,
      publishedAt: r.publishedAt,
      link: `https://github.com/${owner}/${repo}/releases/tag/${r.tag}`,
      tag: r.tag,
    } satisfies ReleaseData
  })
}

async function getReleasesViaForges(
  provider: ProviderId,
  owner: string,
  repo: string,
  host?: string,
) {
  const ref: RepoRef = { provider, owner, repo, host }
  const forgeProvider = await createForgeProvider(ref, { timeout: TIMEOUT_TIME })
  if (!forgeProvider?.can('releases.list')) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }

  const { items: releases } = await forgeProvider.releases.list(toForgeRepoRef(ref)).page()
  const repoInfo = createRepoInfo(ref)
  if (!repoInfo) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }
  const render = await changelogRenderer(repoInfo)

  return releases.map(release => {
    const { html, toc } = render(release.body ?? null, release.ref.id)
    return {
      id: release.ref.id,
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: release.name || release.tag,
      draft: release.isDraft,
      prerelease: release.isPrerelease,
      toc,
      publishedAt: release.publishedAt?.toISOString(),
      link: release.url ?? forgeProvider.urlFor({ release: release.ref }) ?? '',
      tag: release.tag,
    } satisfies ReleaseData
  })
}
