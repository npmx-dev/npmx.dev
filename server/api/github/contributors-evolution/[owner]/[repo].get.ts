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
    const headers = {
      'User-Agent': 'npmx',
      'Accept': 'application/vnd.github+json',
    }

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
    const maxAttempts = 6
    let delayMs = 1000

    try {
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await $fetch.raw<GitHubContributorStats[]>(url, { headers })
        const status = response.status

        if (status === 200) {
          return Array.isArray(response._data) ? response._data : []
        }

        if (status === 204) {
          return []
        }

        if (status === 202) {
          if (attempt === maxAttempts - 1) return []
          await sleep(delayMs)
          delayMs = Math.min(delayMs * 2, 16_000)
          continue
        }

        return []
      }

      return []
    } catch {
      return []
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
  },
)
