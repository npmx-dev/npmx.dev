import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi, beforeEach } from 'vite-plus/test'

const { mockUseAtproto, mockUseProfileLikes } = vi.hoisted(() => ({
  mockUseAtproto: vi.fn(),
  mockUseProfileLikes: vi.fn(),
}))

mockNuxtImport('useAtproto', () => mockUseAtproto)
mockNuxtImport('useProfileLikes', () => mockUseProfileLikes)

import ProfilePage from '~/pages/profile/[identity]/index.vue'

registerEndpoint('/api/social/profile/test-handle', () => ({
  displayName: 'Test User',
  description: '',
  website: '',
  handle: 'test-handle',
  recordExists: false,
}))

describe('Profile invite section', () => {
  beforeEach(() => {
    mockUseAtproto.mockReset()
    mockUseProfileLikes.mockReset()
  })

  it('does not show invite section while auth is still loading', async () => {
    mockUseAtproto.mockReturnValue({
      user: ref(null),
      pending: ref(true),
      logout: vi.fn(),
    })

    mockUseProfileLikes.mockReturnValue({
      data: ref({ records: [] }),
      status: ref('success'),
    })

    const wrapper = await mountSuspended(ProfilePage, {
      route: '/profile/test-handle',
    })

    expect(wrapper.text()).not.toContain("It doesn't look like they're using npmx yet")
  })

  it('shows invite section after auth resolves for non-owner', async () => {
    mockUseAtproto.mockReturnValue({
      user: ref({ handle: 'other-user' }),
      pending: ref(false),
      logout: vi.fn(),
    })

    mockUseProfileLikes.mockReturnValue({
      data: ref({ records: [] }),
      status: ref('success'),
    })

    const wrapper = await mountSuspended(ProfilePage, {
      route: '/profile/test-handle',
    })

    expect(wrapper.text()).toContain("It doesn't look like they're using npmx yet")
  })

  it('does not show invite section for profile owner', async () => {
    mockUseAtproto.mockReturnValue({
      user: ref({ handle: 'test-handle' }),
      pending: ref(false),
      logout: vi.fn(),
    })

    mockUseProfileLikes.mockReturnValue({
      data: ref({ records: [] }),
      status: ref('success'),
    })

    const wrapper = await mountSuspended(ProfilePage, {
      route: '/profile/test-handle',
    })

    expect(wrapper.text()).not.toContain("It doesn't look like they're using npmx yet")
  })
})
