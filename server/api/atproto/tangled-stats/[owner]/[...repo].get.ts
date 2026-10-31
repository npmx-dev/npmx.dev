import { CACHE_MAX_AGE_ONE_MINUTE } from '#shared/utils/constants'
import { createForgeProvider, toForgeRepoRef } from '#shared/utils/forges'
import type { TangledStats } from '#shared/utils/repository-meta'

// Proxied because Tangled reads go to each author's PDS and knot, whose hosts
// can be anything, so the browser's CSP cannot allow them.
export default defineCachedEventHandler(
  async (event): Promise<TangledStats> => {
    const owner = getRouterParam(event, 'owner')
    const repo = getRouterParam(event, 'repo')
    if (!owner || !repo) {
      throw createError({ statusCode: 400, message: 'repository not provided' })
    }

    const ref = { provider: 'tangled' as const, owner, repo }
    const provider = await createForgeProvider(ref)
    if (!provider) {
      throw createError({ statusCode: 500, message: 'Tangled is not supported' })
    }

    const meta = await provider.repos.get(toForgeRepoRef(ref))
    return {
      stars: meta.stars ?? 0,
      forks: meta.forks ?? 0,
      description: meta.description ?? null,
      defaultBranch: meta.defaultBranch,
    }
  },
  {
    maxAge: CACHE_MAX_AGE_ONE_MINUTE * 10,
  },
)
