import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'
import { createError, getRouterParam } from 'nuxt/server'

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

    const ref = { provider: 'github' as const, owner, repo }
    const provider = await createForgeProvider(ref)

    if (!provider?.can('repos.contributorStats')) {
      return []
    }

    try {
      const stats = await provider.repos.contributorStats(toForgeRepoRef(ref))
      return stats.map(stat => ({
        total: stat.commits,
        weeks: stat.weeks.map(week => ({
          w: Math.floor(week.week.getTime() / 1000),
          a: week.additions,
          d: week.deletions,
          c: week.commits,
        })),
      })) satisfies GitHubContributorStats[]
    } catch {
      // Throw instead of returning `[]`: a cached handler never stores an error, so
      // an outage, or stats GitHub is still computing, does not stick for a day.
      throw createError({
        status: 502,
        statusText: 'Failed to fetch contributor statistics from GitHub',
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
  },
)
