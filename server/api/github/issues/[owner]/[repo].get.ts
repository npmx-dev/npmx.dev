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

    try {
      const data = await $fetch<GitHubSearchResponse>(url, {
        headers: GITHUB_HEADERS,
      })
      return {
        owner,
        repo,
        issues: data.total_count,
      }
    } catch (error: any) {
      throw createError({
        statusCode: error.response?.status || 500,
        statusMessage: error.response?._data?.message || 'Failed to fetch issue count from GitHub',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'github-issue-count',
    getKey: (event) => {
      const owner = getRouterParam(event, 'owner')
      const repo = getRouterParam(event, 'repo')
      return `${owner}/${repo}`
    },
  },
)
