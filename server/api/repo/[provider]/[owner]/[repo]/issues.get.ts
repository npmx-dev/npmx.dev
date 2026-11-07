import { CACHE_MAX_AGE_ONE_HOUR } from '#shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '#shared/utils/forges'
import { getRepoRef, repoCacheKey } from '#server/utils/repo-route'

export interface RepoIssueCountResponse {
  owner: string
  repo: string
  issues: number | null
}

export default defineCachedEventHandler(
  async (event): Promise<RepoIssueCountResponse> => {
    const ref = getRepoRef(event)
    const provider = await createForgeProvider(ref)

    if (!provider?.can('search.threads')) {
      return { owner: ref.owner, repo: ref.repo, issues: null }
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

      return { owner: ref.owner, repo: ref.repo, issues: page.total ?? null }
    } catch {
      throw createError({
        statusCode: 502,
        statusMessage: `Failed to fetch issue count from ${ref.provider}`,
      })
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_HOUR,
    swr: true,
    name: 'repo-issue-count',
    getKey: repoCacheKey,
  },
)
