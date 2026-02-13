import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'

const REPO = 'npmx-dev/npmx.dev'
const GITHUB_HEADERS = {
  'Accept': 'application/vnd.github.v3+json',
  'User-Agent': 'npmx',
} as const

interface GitHubSearchResponse {
  total_count: number
}

export interface RepoStats {
  contributors: number
  commits: number
  pullRequests: number
}

export default defineCachedEventHandler(
  async (): Promise<RepoStats> => {
    const [contributorsCount, commitsCount, prsCount] = await Promise.all([
      fetchPageCount(`https://api.github.com/repos/${REPO}/contributors?per_page=1&anon=false`),
      fetchPageCount(`https://api.github.com/repos/${REPO}/commits?per_page=1`),
      fetchSearchCount('issues', `repo:${REPO} is:pr is:merged`),
    ])

    return {
      contributors: contributorsCount,
      commits: commitsCount,
      pullRequests: prsCount,
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'repo-stats',
    getKey: () => 'repo-stats',
  },
)

/**
 * Count items by requesting a single result and reading the last page
 * number from the Link header.
 */
async function fetchPageCount(url: string): Promise<number> {
  const response = await fetch(url, { headers: GITHUB_HEADERS })

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `Failed to fetch ${url}` })
  }

  const link = response.headers.get('link')
  if (link) {
    const match = link.match(/[?&]page=(\d+)>;\s*rel="last"/)
    if (match?.[1]) {
      return Number.parseInt(match[1], 10)
    }
  }

  // No Link header means only one page — count the response body
  const body = (await response.json()) as unknown[]
  return body.length
}

/**
 * Use the GitHub search API to get a total_count for issues/PRs.
 */
async function fetchSearchCount(type: 'issues', query: string): Promise<number> {
  const response = await fetch(
    `https://api.github.com/search/${type}?q=${encodeURIComponent(query)}&per_page=1`,
    { headers: GITHUB_HEADERS },
  )

  if (!response.ok) {
    throw createError({ statusCode: response.status, message: `Failed to fetch ${type} count` })
  }

  const data = (await response.json()) as GitHubSearchResponse
  return data.total_count
}
