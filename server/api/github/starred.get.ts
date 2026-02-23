import { createError, getQuery } from 'h3'
import { useServerSession } from '#server/utils/server-session'
import { handleApiError } from '#server/utils/error-handler'

export default defineEventHandler(async event => {
  const session = await useServerSession(event)
  const github = session.data.github

  if (!github?.accessToken) {
    return { starred: false, connected: false }
  }

  const query = getQuery(event)
  const owner = query.owner?.toString()
  const repo = query.repo?.toString()

  if (!owner || !repo) {
    throw createError({
      statusCode: 400,
      message: 'Missing owner or repo query parameter.',
    })
  }

  try {
    // returns 204 if starred, 404 if not
    const response = await $fetch.raw(`https://api.github.com/user/starred/${owner}/${repo}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${github.accessToken}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'npmx',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      ignoreResponseError: true,
    })

    return { starred: response.status === 204, connected: true }
  } catch (error) {
    return handleApiError(error, {
      statusCode: 500,
      statusMessage: 'Internal Server Error',
      message: 'Failed to check star status.',
    })
  }
})
