import { describe, expect, it, vi } from 'vitest'
import fixture from '~~/test/fixtures/algolia/search/security-holder.json'

const mockSearch = vi.fn()
vi.mock('algoliasearch/lite', () => ({
  liteClient: () => ({ search: mockSearch }),
}))

describe('useAlgoliaSearch', () => {
  it('maps isSecurityHeld through to NpmSearchResult.package', async () => {
    mockSearch.mockResolvedValue({
      results: [{ hits: fixture, nbHits: fixture.length }],
    })

    const { search } = useAlgoliaSearch()
    const { objects } = await search('')

    const bad = objects.find(o => o.package.name === 'vuln-npm')
    const good = objects.find(o => o.package.name === 'npmx-connector')

    expect(bad?.package.isSecurityHeld).toBe(true)
    expect(good?.package.isSecurityHeld).toBe(false)

    const filtered = objects.filter(o => !o.package.isSecurityHeld).map(o => o.package.name)
    expect(filtered).toEqual(['npmx-connector'])
  })
})
