import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '~~/shared/utils/forges'

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

    const ref = { provider: 'github' as const, owner, repo }
    const provider = createForgeProvider(ref)

    if (!provider) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch issue count from GitHub',
      })
    }

    try {
      // The search API reports the total, so a one-item page is enough.
      const page = await provider.search
        .threads({
          repo: toForgeRepoRef(ref),
          kind: 'issue',
          state: 'open',
          perPage: 1,
        })
        .page()

      return { owner, repo, issues: page.total ?? null }
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
