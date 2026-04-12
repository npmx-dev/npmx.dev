import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

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
        statusCode: 400,
        statusMessage: 'Owner and repo are required parameters.',
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
        statusCode: 500,
        statusMessage: 'Failed to fetch issue count from GitHub',
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
