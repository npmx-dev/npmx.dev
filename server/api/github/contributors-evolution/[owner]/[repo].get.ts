import { CACHE_MAX_AGE_ONE_DAY } from '#shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'

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
        statusCode: 400,
        message: 'repository not provided',
      })
    }

    const ref = { provider: 'github' as const, owner, repo }
    const provider = createForgeProvider(ref)

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
      return []
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_DAY,
  },
)
