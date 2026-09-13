import type { ProviderId } from '~~/shared/utils/git-providers'
import * as v from 'valibot'
import { ERROR_THROW_INCOMPLETE_PARAM } from '~~/shared/utils/constants'
import {
  ForgejoReleaseSchama,
  GithubReleaseCollectionSchama,
  GitlabReleaseSchame,
} from '~~/shared/schemas/changelog/release'
import { validateHostWithValibot } from '~~/server/utils/changelog/validateHost'

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
    const encodedTag = encodeURIComponent(tag)

    setHeader(event, 'content-type', 'text/markdown')

    try {
      switch (provider) {
        case 'github':
          return getMarkdownFromGithub(owner, repo, tag, encodedTag)
        case 'codeberg':
          return await getMarkdownFromForgejo(owner, repo, encodedTag, 'codeberg.org')
        case 'forgejo':
          return await getMarkdownFromForgejo(owner, repo, encodedTag, host)
        case 'gitlab':
          return await getMarkdownFromGitlab(owner, repo, encodedTag, host)
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

async function getMarkdownFromGithub(owner: string, repo: string, tag: string, encodedTag: string) {
  // ungh does not yet have an endpoint to get the release by tag, we will first attempt to get it from the github api directly
  // https://github.com/unjs/ungh/pull/162

  const responseGithub = await $fetch(
    `https://api.github.com/repos/${owner}/${repo}/releases/tags/${encodedTag}`,
    {
      headers: {
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'npmx.dev',
      },
      ignoreResponseError: true,
    },
  )

  const parsed = v.safeParse(v.object({ body: v.string() }), responseGithub)

  if (parsed.success) {
    return parsed.output.body
  }

  // via github api didn't work, most likely due to rate limit
  // trying ungh releases list instead;

  const responseUngh = await $fetch(`https://ungh.cc/repos/${owner}/${repo}/releases`, {
    headers: {
      'Accept': '*/*',
      'User-Agent': 'npmx.dev',
    },
  })

  const { releases } = v.parse(GithubReleaseCollectionSchama, responseUngh)

  const decodedTag = tag
  for (const release of releases) {
    if (release.tag == decodedTag) {
      return release.markdown
    }
  }

  throw createError({
    status: 404,
    statusMessage: ERROR_CHANGELOG_NOT_FOUND,
  })
}

async function getMarkdownFromForgejo(
  owner: string,
  repo: string,
  /** tag should be encoded */
  tag: string,
  host: string = 'codeberg.org',
) {
  const data = await $fetch(`https://${host}/api/v1/repos/${owner}/${repo}/releases/tags/${tag}`, {
    headers: {
      'User-Agent': 'npmx.dev',
    },
  })

  const release = v.parse(ForgejoReleaseSchama, data)

  return release.body
}

async function getMarkdownFromGitlab(
  owner: string,
  repo: string,
  /** tag should be encoded */
  tag: string,
  host: string = 'gitlab.com',
) {
  owner = decodeURIComponent(owner)

  const repoPath = encodeURIComponent(`${owner}/${repo}`)
  const data = await $fetch(`https://${host}/api/v4/projects/${repoPath}/releases/${tag}`, {
    headers: {
      'User-Agent': 'npmx.dev',
    },
  })

  const release = v.parse(GitlabReleaseSchame, data)

  return release.description
}
