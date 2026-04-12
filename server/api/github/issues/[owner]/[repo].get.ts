import { setTimeout } from 'node:timers/promises'
import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'npmx',
  'X-GitHub-Api-Version': '2022-11-28',
} as const

interface GitHubSearchResponse {
  total_count: number
}

export interface GithubIssueCountResponse {
  owner: string
  repo: string
  issues: number
}

export default defineCachedEventHandler(
  async (event): Promise<GithubIssueCountResponse> => {
    const owner = getRouterParam(event, 'owner')
    const repo = getRouterParam(event, 'repo')

    if (!owner || !repo) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Owner and repo are required parameters.',
      })
    }

    const query = `repo:${owner}/${repo} is:issue is:open`
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=1`

    const maxAttempts = 3
    let delayMs = 1000

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await $fetch.raw<GitHubSearchResponse>(url, {
          headers: GITHUB_HEADERS,
          timeout: 10000,
        })

        if (response.status === 200) {
          return {
            owner,
            repo,
            issues: response._data?.total_count ?? 0,
          }
        }

        if (response.status === 202) {
          if (attempt === maxAttempts - 1) break
          await setTimeout(delayMs)
          delayMs = Math.min(delayMs * 2, 16_000)
          continue
        }

        break
      } catch (error: any) {
        if (attempt === maxAttempts - 1) {
          throw createError({
            statusCode: error.response?.status || 500,
            statusMessage:
              error.response?._data?.message || 'Failed to fetch issue count from GitHub',
          })
        }
        await setTimeout(delayMs)
        delayMs = Math.min(delayMs * 2, 16_000)
      }
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch issue count from GitHub after retries',
    })
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'github-issue-count',
    getKey: event => {
      const owner = getRouterParam(event, 'owner')
      const repo = getRouterParam(event, 'repo')
      return `${owner}/${repo}`
    },
  },
)
