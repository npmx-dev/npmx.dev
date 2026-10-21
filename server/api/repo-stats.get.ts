import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'

const REPO = 'npmx-dev/npmx.dev'

export interface RepoStats {
  contributors: number
  commits: number
  pullRequests: number
}

export default defineCachedEventHandler(
  async (): Promise<RepoStats> => {
    const ref = { provider: 'github' as const, owner: 'npmx-dev', repo: 'npmx.dev' }
    const provider = createForgeProvider(ref)

    if (!provider) {
      throw createError({ statusCode: 500, message: `Failed to read ${REPO}` })
    }

    const target = toForgeRepoRef(ref)

    // Each count comes from the total on a one-item page.
    const [contributors, commits, pullRequests] = await Promise.all([
      provider.repos
        .contributors(target, { perPage: 1 })
        .page()
        .then(page => page.total ?? 0),
      provider.commits
        .list(target, { perPage: 1 })
        .page()
        .then(page => page.total ?? 0),
      provider.search
        .threads({
          repo: target,
          kind: 'pull_request',
          state: 'closed',
          queryRaw: 'is:merged',
          perPage: 1,
        })
        .page()
        .then(page => page.total ?? 0),
    ])

    return { contributors, commits, pullRequests }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'repo-stats',
    getKey: () => 'repo-stats',
  },
)
