import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockUseAlgoliaSearch, mockSearch } = vi.hoisted(() => {
  const search = vi.fn()
  return {
    mockSearch: search,
    mockUseAlgoliaSearch: vi.fn(() => ({ search })),
  }
})

mockNuxtImport('useAlgoliaSearch', () => mockUseAlgoliaSearch)

import OgImageUserProfile from '~/components/OgImage/UserProfile.takumi.vue'

/** Build the minimal NpmSearchResponse shape the component reads (`total`). */
function searchResponse(total: number) {
  return { isStale: false, objects: [], total, time: '' }
}

/** Spy on the global `$fetch` used for the npm-registry fallback. */
function mockNpmFallback(total: number | null) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.spyOn(globalThis, '$fetch').mockImplementation((() =>
    total === null ? Promise.reject(new Error('network')) : Promise.resolve({ total })) as any)
}

describe('OgImageUserProfile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockSearch.mockReset()
  })

  it('renders the username with a tilde prefix', async () => {
    mockSearch.mockResolvedValue(searchResponse(9))

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'houtan-rocky' },
    })

    expect(component.text()).toContain('~houtan-rocky')
  })

  it('shows the Algolia package count', async () => {
    mockSearch.mockResolvedValue(searchResponse(9))

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'houtan-rocky' },
    })

    expect(component.text()).toContain('9 packages')
    // Algolia had results, so the npm fallback must not run.
    expect(mockSearch).toHaveBeenCalledWith('', { filters: 'owners.name:houtan-rocky', size: 1 })
  })

  it('queries Algolia by the maintainer, not the raw username field', async () => {
    mockSearch.mockResolvedValue(searchResponse(3))

    await mountSuspended(OgImageUserProfile, { props: { username: 'sindresorhus' } })

    expect(mockSearch).toHaveBeenCalledWith('', {
      filters: 'owners.name:sindresorhus',
      size: 1,
    })
  })

  it('uses the singular noun for a single package', async () => {
    mockSearch.mockResolvedValue(searchResponse(1))

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'solo' },
    })

    expect(component.text()).toContain('1 package')
    expect(component.text()).not.toContain('1 packages')
  })

  it('falls back to the npm registry when Algolia returns zero', async () => {
    mockSearch.mockResolvedValue(searchResponse(0))
    mockNpmFallback(11)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'npm-only' },
    })

    expect($fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/-/v1/search',
      expect.objectContaining({ params: { text: 'maintainer:npm-only', size: 1 } }),
    )
    expect(component.text()).toContain('11 packages')
  })

  it('shows zero packages when both providers are empty', async () => {
    mockSearch.mockResolvedValue(searchResponse(0))
    mockNpmFallback(0)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'nobody' },
    })

    expect(component.text()).toContain('0 packages')
  })

  it('degrades to zero packages when the npm fallback rejects', async () => {
    mockSearch.mockResolvedValue(searchResponse(0))
    mockNpmFallback(null)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'flaky' },
    })

    expect(component.text()).toContain('0 packages')
  })

  it('falls back to the npm registry when Algolia throws', async () => {
    mockSearch.mockRejectedValue(new Error('algolia down'))
    mockNpmFallback(11)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'houtan-rocky' },
    })

    expect(component.text()).toContain('~houtan-rocky')
    expect($fetch).toHaveBeenCalledWith(
      'https://registry.npmjs.org/-/v1/search',
      expect.objectContaining({ params: { text: 'maintainer:houtan-rocky', size: 1 } }),
    )
    expect(component.text()).toContain('11 packages')
  })

  it('degrades to zero packages when both providers fail', async () => {
    mockSearch.mockRejectedValue(new Error('algolia down'))
    mockNpmFallback(null)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'houtan-rocky' },
    })

    expect(component.text()).toContain('0 packages')
  })

  it('skips the lookups for an invalid username', async () => {
    // Rejecting mock guards against a real network call if the skip path regresses.
    mockNpmFallback(null)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'not a valid name!' },
    })

    expect(mockSearch).not.toHaveBeenCalled()
    expect($fetch).not.toHaveBeenCalled()
    expect(component.text()).toContain('0 packages')
  })

  it('renders a generic description and skips fetching when no username is given', async () => {
    // Rejecting mock guards against a real network call if the skip path regresses.
    mockNpmFallback(null)

    const component = await mountSuspended(OgImageUserProfile, { props: {} })

    expect(component.text()).toContain('npm user profile')
    expect(mockSearch).not.toHaveBeenCalled()
    expect($fetch).not.toHaveBeenCalled()
  })
})
