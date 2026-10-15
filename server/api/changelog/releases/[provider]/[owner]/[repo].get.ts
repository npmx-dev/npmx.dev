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
import { requestSignal } from '~~/server/utils/requestSignal'

const TIMEOUT_TIME = 15_000

export default defineCachedEventHandler(
  async event => {
    const provider = getRouterParam(event, 'provider') as ProviderId
    const repo = getRouterParam(event, 'repo')
    const owner = getRouterParam(event, 'owner')

    if (!repo || !provider || !owner) {
      throw createError({
        status: 404,
        statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
      })
    }
    const rawQuery = getQuery(event)
    const { host } = v.parse(v.object({ host: validateHostWithValibot(provider) }), rawQuery)

    try {
      // GitHub is deliberately read through ungh.cc to stay clear of GitHub's
      // anonymous rate limits; `forges` has no proxy, so it is not used here.
      // TODO(serhalp): refactor to use `forges` once it can read GitHub through ungh.
      if (provider === 'github') {
        return await getReleasesFromGithub(owner, repo)
      }
      return await getReleasesViaForges(
        provider,
        owner,
        repo,
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

/** Releases for every provider `forges` can read releases for (GitLab, Forgejo, Gitea, Gitee). */
async function getReleasesViaForges(
  provider: ProviderId,
  owner: string,
  repo: string,
  host?: string,
  signal?: AbortSignal,
) {
  const ref: RepoRef = { provider, owner, repo, host }
  const forgeProvider = createForgeProvider(ref, { timeout: TIMEOUT_TIME })
  if (!forgeProvider?.can('releases.list')) {
    throw createError({
      status: 404,
      statusMessage: ERROR_CHANGELOG_NOT_FOUND,
    })
  }

  const { items: releases } = await forgeProvider.releases.listPage(toForgeRepoRef(ref), { signal })
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
