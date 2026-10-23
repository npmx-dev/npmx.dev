import { describe, expect, it, vi } from 'vitest'
import type { CachedFetchFunction } from '#shared/utils/fetch-cache-config'
import type { RepoRef } from '#shared/utils/git-providers'
import { getRepoMeta } from '#shared/utils/repository-meta'

function createCachedFetch(response: () => unknown) {
  return vi.fn(async () => ({
    data: response(),
    isStale: false,
    cachedAt: null,
  })) as unknown as CachedFetchFunction & ReturnType<typeof vi.fn>
}

describe('getRepoMeta', () => {
  describe('Pushin', () => {
    const ref: RepoRef = { provider: 'pushin', owner: 'tobbe', repo: 'npmx-pushin-test' }

    it('fetches repository details from the Pushin API', async () => {
      const cachedFetch = createCachedFetch(() => ({
        id: 1110,
        description: 'Package to test the npmx pushin integration',
        default_branch: 'main',
        stargazers_count: 1,
        forks_count: 2,
        watchers_count: 3,
      }))

      const result = await getRepoMeta(cachedFetch, ref)

      expect(cachedFetch).toHaveBeenCalledWith(
        'https://pushin.eu/api/v1/repos/tobbe/npmx-pushin-test',
        expect.anything(),
        expect.any(Number),
      )
      expect(result).toEqual({
        provider: 'pushin',
        url: 'https://pushin.eu/tobbe/npmx-pushin-test',
        stars: 1,
        forks: 2,
        watchers: 3,
        description: 'Package to test the npmx pushin integration',
        defaultBranch: 'main',
        links: {
          repo: 'https://pushin.eu/tobbe/npmx-pushin-test',
          stars: 'https://pushin.eu/tobbe/npmx-pushin-test/stargazers',
          forks: 'https://pushin.eu/tobbe/npmx-pushin-test',
          watchers: 'https://pushin.eu/tobbe/npmx-pushin-test',
        },
      })
    })

    it('defaults missing counts to zero', async () => {
      const cachedFetch = createCachedFetch(() => ({ id: 1110 }))

      const result = await getRepoMeta(cachedFetch, ref)

      expect(result).toMatchObject({ stars: 0, forks: 0, watchers: 0, description: null })
    })

    it('returns null when the request fails', async () => {
      const cachedFetch = createCachedFetch(() => {
        throw new Error('Rate limited')
      })

      const result = await getRepoMeta(cachedFetch, ref)

      expect(result).toBeNull()
    })
  })
})
