import { createError, readBody } from 'h3'
import * as v from 'valibot'
import { GitHubStarBodySchema } from '#shared/schemas/github'
import { useServerSession } from '#server/utils/server-session'
import { handleApiError } from '#server/utils/error-handler'

export default defineEventHandler(async event => {
  const session = await useServerSession(event)
  const github = session.data.github

  if (!github?.accessToken) {
    throw createError({
      statusCode: 401,
      message: 'GitHub account not connected.',
    })
  }

  const { owner, repo } = v.parse(GitHubStarBodySchema, await readBody(event))

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'Missing owner or repo in request body.',
    })
  }

  try {
    await $fetch(`https://api.github.com/user/starred/${owner}/${repo}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${github.accessToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'npmx',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Length': '0',
      },
    })

    return { starred: true }
  } catch (error) {
    return handleApiError(error, {
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to star repository.',
    })
  }
})
