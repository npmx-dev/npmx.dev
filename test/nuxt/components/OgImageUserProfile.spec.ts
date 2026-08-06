import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

const { mockUseUserPackages, mockRefresh } = vi.hoisted(() => ({
  mockRefresh: vi.fn(),
  mockUseUserPackages: vi.fn(),
}))

mockNuxtImport('useUserPackages', () => mockUseUserPackages)

import OgImageUserProfile from '~/components/OgImage/UserProfile.takumi.vue'

/**
 * Wire up the `useUserPackages` mock so the total only becomes available after
 * `refresh()` is awaited — mirroring the real `useLazyAsyncData` behaviour where
 * the fetcher does not resolve during the island's synchronous setup. This makes
 * the tests a regression guard: a component that reads `data` without awaiting
 * `refresh()` sees `null` and renders "0 packages".
 */
function mockPackages(total: number | null) {
  const data = shallowRef<{ total: number } | null>(null)
  mockRefresh.mockImplementation(async () => {
    data.value = total === null ? null : { total }
  })
  mockUseUserPackages.mockReturnValue({ data, refresh: mockRefresh })
}

describe('OgImageUserProfile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockUseUserPackages.mockReset()
    mockRefresh.mockReset()
  })

  it('renders the username with a tilde prefix', async () => {
    mockPackages(9)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'houtan-rocky' },
    })

    expect(component.text()).toContain('~houtan-rocky')
  })

  it('shows the package count from useUserPackages', async () => {
    mockPackages(9)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'houtan-rocky' },
    })

    expect(component.text()).toContain('9 packages')
    expect(mockUseUserPackages).toHaveBeenCalledWith('houtan-rocky')
    // The fetch must be forced — `useLazyAsyncData` does not resolve on its own
    // during the island's synchronous setup.
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('uses the singular noun for a single package', async () => {
    mockPackages(1)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'solo' },
    })

    expect(component.text()).toContain('1 package')
    expect(component.text()).not.toContain('1 packages')
  })

  it('shows zero packages when the user has none', async () => {
    mockPackages(0)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'nobody' },
    })

    expect(component.text()).toContain('0 packages')
  })

  it('degrades to zero packages when no data resolves', async () => {
    mockPackages(null)

    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'flaky' },
    })

    expect(component.text()).toContain('0 packages')
  })

  it('skips the lookup for an invalid username', async () => {
    const component = await mountSuspended(OgImageUserProfile, {
      props: { username: 'not a valid name!' },
    })

    expect(mockUseUserPackages).not.toHaveBeenCalled()
    expect(component.text()).toContain('0 packages')
  })

  it('renders a generic description and skips fetching when no username is given', async () => {
    const component = await mountSuspended(OgImageUserProfile, { props: {} })

    expect(component.text()).toContain('npm user profile')
    expect(mockUseUserPackages).not.toHaveBeenCalled()
  })
})
