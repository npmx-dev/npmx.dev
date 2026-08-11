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

  it('places an exact package match before the regular search results', async () => {
    const otherHit = fixture.find(hit => hit.name === 'vuln-npm')
    const exactHit = fixture.find(hit => hit.name === 'npmx-connector')

    if (!otherHit || !exactHit) {
      throw new Error('Expected Algolia fixtures are missing')
    }

    mockSearch.mockResolvedValue({
      results: [
        { hits: [otherHit], nbHits: 2 },
        { hits: [exactHit], nbHits: 1 },
      ],
    })

    const { searchWithSuggestions } = useAlgoliaSearch()
    const result = await searchWithSuggestions(
      'npmx-connector',
      {},
      { checkPackage: 'npmx-connector' },
    )

    expect(result.packageExists).toBe(true)
    expect(result.search.objects.map(item => item.package.name)).toEqual([
      'npmx-connector',
      'vuln-npm',
    ])
  })
})
