import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { createError, getRouterParam } from 'nuxt/server'
import { defineCachedEventHandler } from '#server/utils/cached-handler'
import { fetchGitHubWithRetries } from '#server/utils/github'

interface GitHubSearchResponse {
  total_count: number
}

export interface GithubIssueCountResponse {
  owner: string
  repo: string
  issues: number | null
}

export default defineCachedEventHandler(
  async (event): Promise<GithubIssueCountResponse> => {
    const owner = getRouterParam(event, 'owner')
    const repo = getRouterParam(event, 'repo')

    if (!owner || !repo) {
      throw createError({
        status: 400,
        statusText: 'Owner and repo are required parameters.',
      })
    }

    const query = `repo:${owner}/${repo} is:issue is:open`
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=1`

    try {
      const data = await fetchGitHubWithRetries<GitHubSearchResponse>(url, {
        timeout: 10000,
      })

      return {
        owner,
        repo,
        issues: typeof data?.total_count === 'number' ? data.total_count : null,
      }
    } catch {
      throw createError({
        status: 500,
        statusText: 'Failed to fetch issue count from GitHub',
      })
    }
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
