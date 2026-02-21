import * as v from 'valibot'
import {
  ERROR_CHANGELOG_FILE_FAILED,
  ERROR_THROW_INCOMPLETE_PARAM,
} from '~~/shared/utils/constants'

export default defineCachedEventHandler(async event => {
  const provider = getRouterParam(event, 'provider')
  const repo = getRouterParam(event, 'repo')
  const owner = getRouterParam(event, 'owner')
  const path = getRouterParam(event, 'path')

  if (!repo || !provider || !owner || !path) {
    throw createError({
      status: 404,
      statusMessage: ERROR_THROW_INCOMPLETE_PARAM,
    })
  }

  try {
    console.log({ provider })

    switch (provider as ProviderId) {
      case 'github':
        return await getGithubMarkDown(owner, repo, path)

      default:
        throw createError({
          status: 404,
          statusMessage: ERROR_CHANGELOG_NOT_FOUND,
        })
    }
  } catch (error) {
    handleApiError(error, {
      statusCode: 502,
      message: ERROR_CHANGELOG_FILE_FAILED,
    })
  }
})

async function getGithubMarkDown(owner: string, repo: string, path: string) {
  const data = await $fetch(`https://ungh.cc/repos/${owner}/${repo}/files/HEAD/${path}`)

  const markdown = v.parse(v.string(), data)

  return (await changelogRenderer())(markdown)
}
