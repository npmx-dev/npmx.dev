import type { ProviderId } from '~~/shared/utils/git-providers'
import type { ReleaseData } from '~~/shared/types/changelog'
import * as v from 'valibot'
import {
  ERROR_CHANGELOG_RELEASES_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'
import {
  GithubReleaseCollectionSchama,
  ForgejoReleaseCollectionSchema,
  GitlabReleaseCollectionSchema,
} from '~~/shared/schemas/changelog/release'
import { changelogRenderer } from '~~/server/utils/changelog/markdown'
import { createForgejoRepoInfo, createGithubRepoInfo } from '~~/server/utils/changelog/mdRepoInfo'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'

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
      switch (provider) {
        case 'github':
          return await getReleasesFromGithub(owner, repo)
        case 'codeberg':
          return await getReleasesFromForgejo(owner, repo, 'codeberg.org')
        case 'forgejo':
          return await getReleasesFromForgejo(owner, repo, host)
        case 'gitlab':
          return await getReleasesFromGitlab(owner, repo, host)

        default:
          throw createError({
            status: 404,
            statusMessage: ERROR_CHANGELOG_NOT_FOUND,
          })
      }
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
  })

  const { releases } = v.parse(GithubReleaseCollectionSchama, data)

  const render = await changelogRenderer(createGithubRepoInfo(owner, repo))

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

async function getReleasesFromForgejo(owner: string, repo: string, host: string) {
  const data = await $fetch(`https://${host}/api/v1/repos/${owner}/${repo}/releases?draft=false`, {
    headers: {
      'User-Agent': 'npmx.dev',
    },
  })
  const releases = v.parse(ForgejoReleaseCollectionSchema, data)

  const render = await changelogRenderer(createForgejoRepoInfo(host, owner, repo))

  return releases.map(r => {
    const { html, toc } = render(r.body, r.id)
    return {
      id: r.id,
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: r.name || r.tag_name,
      prerelease: r.prerelease,
      toc,
      link: r.html_url,
      publishedAt: r.published_at,
      draft: r.draft,
      tag: r.tag_name,
    } satisfies ReleaseData
  })
}

async function getReleasesFromGitlab(owner: string, repo: string, host: string) {
  owner = decodeURIComponent(owner)

  const repoPath = encodeURIComponent(`${owner}/${repo}`)

  const data = await $fetch(`https://${host}/api/v4/projects/${repoPath}/releases`, {
    headers: {
      'User-Agent': 'npmx.dev',
    },
  })

  const releases = v.parse(GitlabReleaseCollectionSchema, data)

  const render = await changelogRenderer(createGitLabRepoInfo(host, owner, repo))

  return releases.map(r => {
    const { html, toc } = render(r.description, r.commit.short_id)
    return {
      id: r.commit.short_id,
      html: html?.replace(/(?<!>)\n/g, '<br>') ?? null,
      title: r.name || r.tag_name,
      prerelease: r.upcoming_release,
      toc,
      publishedAt: r.released_at,
      // oxlint-disable-next-line no-underscore-dangle
      link: r._links.self,
      tag: r.tag_name,
    } satisfies ReleaseData
  })
}
