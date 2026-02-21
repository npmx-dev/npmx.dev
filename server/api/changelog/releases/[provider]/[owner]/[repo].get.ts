import type { ProviderId } from '~~/shared/utils/git-providers'
import type { ReleaseData } from '~~/shared/types/changelog'
import {
  ERROR_CHANGELOG_RELEASES_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'
import { GithubReleaseCollectionSchama } from '~~/shared/schemas/changelog/release'
import { parse } from 'valibot'
import { changelogRenderer } from '~~/server/utils/changelog/markdown'

export default defineCachedEventHandler(async event => {
  const provider = getRouterParam(event, 'provider')
  const repo = getRouterParam(event, 'repo')
  const owner = getRouterParam(event, 'owner')

  if (!repo || !provider || !owner) {
    throw createError({
      status: 404,
      statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
    })
  }

  try {
    switch (provider as ProviderId) {
      case 'github':
        return await getReleasesFromGithub(owner, repo)

      default:
        throw createError({
          status: 404,
          statusMessage: ERROR_CHANGELOG_NOT_FOUND,
        })
    }
  } catch (error) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_CHANGELOG_RELEASES_FAILED,
    })
  }
})

async function getReleasesFromGithub(owner: string, repo: string) {
  const data = await $fetch(`https://ungh.cc/repos/${owner}/${repo}/releases`, {
    headers: {
      'Accept': '*/*',
      'User-Agent': 'npmx.dev',
    },
  })

  const { releases } = parse(GithubReleaseCollectionSchama, data)

  const render = await changelogRenderer()

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
    } satisfies ReleaseData
  })
}
