import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'

type GitHubContributorWeek = {
  w: number
  a: number
  d: number
  c: number
}

type GitHubContributorStats = {
  total: number
  weeks: GitHubContributorWeek[]
}

export default defineCachedEventHandler(
  async event => {
    const owner = getRouterParam(event, 'owner')
    const repo = getRouterParam(event, 'repo')

    if (!owner || !repo) {
      throw createError({
        status: 400,
        message: 'repository not provided',
      })
    }

    const url = `https://api.github.com/repos/${owner}/${repo}/stats/contributors`

    try {
      const data = await fetchGitHubWithRetries<GitHubContributorStats[]>(url, {
        maxAttempts: 6,
      })

      return Array.isArray(data) ? data : []
    } catch {
      return []
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
  },
)
