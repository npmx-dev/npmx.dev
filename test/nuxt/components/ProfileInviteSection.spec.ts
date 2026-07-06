import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ProfilePage from '~/pages/profile/[identity]/index.vue'

function createAtprotoUser(handle: string) {
  return {
    did: `did:plc:${handle}`,
    handle,
    pds: 'https://bsky.social',
  }
}

let authSessionHandler: () => unknown | Promise<unknown> = () => null

registerEndpoint('/api/social/profile/test-handle', () => ({
  displayName: 'Test User',
  description: '',
  website: '',
  handle: 'test-handle',
  recordExists: false,
}))

registerEndpoint('/api/auth/session', () => authSessionHandler())

registerEndpoint('/api/social/profile/test-handle/likes', () => ({
  cursor: null,
  likes: [],
}))

describe('Profile invite section', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    clearNuxtData()
    authSessionHandler = () => null
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('does not show invite section while auth is still loading', async () => {
    let resolveAuthSession!: () => void
    authSessionHandler = () =>
      new Promise(resolve => {
        resolveAuthSession = () => resolve(null)
      })

    const component = await mountSuspended(ProfilePage, {
      route: '/profile/test-handle',
    })
    wrapper = component

    expect(component.text()).not.toContain("It doesn't look like they're using npmx yet")
    resolveAuthSession()
  })

  it('shows invite section after auth resolves for non-owner', async () => {
    authSessionHandler = () => createAtprotoUser('other-user')

    const component = await mountSuspended(ProfilePage, {
      route: '/profile/test-handle',
    })
    wrapper = component

    await vi.waitFor(() => {
      expect(component.text()).toContain("It doesn't look like they're using npmx yet")
    })
  })

  it('does not show invite section for profile owner', async () => {
    let authSessionRequests = 0
    authSessionHandler = () => {
      authSessionRequests++
      return createAtprotoUser('test-handle')
    }

    const component = await mountSuspended(ProfilePage, {
      route: '/profile/test-handle',
    })
    wrapper = component

    await vi.waitFor(() => {
      expect(authSessionRequests).toBeGreaterThan(0)
    })
    expect(component.text()).not.toContain("It doesn't look like they're using npmx yet")
  })
})
