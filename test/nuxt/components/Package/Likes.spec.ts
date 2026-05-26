import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Likes from '~/components/Package/Likes.vue'

function createAtprotoUser(handle: string) {
  return {
    did: `did:plc:${handle}`,
    handle,
    pds: 'https://bsky.social',
  }
}

let authSessionHandler: () => unknown = () => null

registerEndpoint('/api/auth/session', () => authSessionHandler())

describe('PackageLikes', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    clearNuxtData()
    authSessionHandler = () => null
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('renders the top liked badge with rank and leaderboard link', async () => {
    registerEndpoint('/api/social/likes/vue', () => ({
      totalLikes: 42,
      userHasLiked: false,
      topLikedRank: 3,
    }))

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'vue' },
      attachTo: document.body,
    })

    // Likes fetches client-side (`server: false`), so the mounted component needs
    // to wait for the post-mount request to resolve before asserting on fetched UI.
    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('42')
      expect(wrapper?.find('[data-testid="top-liked-badge"]').exists()).toBe(true)
    })

    const badge = wrapper.find('[data-testid="top-liked-badge"]')
    expect(badge.text()).toContain('#3')
    expect(badge.attributes('href')).toBe('/leaderboard/likes')
    expect(badge.attributes('aria-label')).toBe(
      'View likes leaderboard. This package is ranked #3.',
    )
  })

  it('does not render the top liked badge when rank is unavailable', async () => {
    registerEndpoint('/api/social/likes/react', () => ({
      totalLikes: 42,
      userHasLiked: false,
      topLikedRank: null,
    }))

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'react' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('42')
    })

    expect(wrapper.find('[data-testid="top-liked-badge"]').exists()).toBe(false)
  })

  it('keeps the top liked badge when a like response omits the rank', async () => {
    let authSessionRequests = 0
    let likeRequests = 0
    authSessionHandler = () => {
      authSessionRequests++
      return createAtprotoUser('tester.test')
    }

    registerEndpoint('/api/social/likes/svelte', () => ({
      totalLikes: 42,
      userHasLiked: false,
      topLikedRank: 3,
    }))
    registerEndpoint('/api/social/like', {
      method: 'POST',
      handler: () => {
        likeRequests++

        return {
          totalLikes: 43,
          userHasLiked: true,
          topLikedRank: null,
        }
      },
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'svelte' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(wrapper?.find('[data-testid="top-liked-badge"]').text()).toContain('#3')
      expect(authSessionRequests).toBeGreaterThan(0)
    })

    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => {
      expect(likeRequests).toBe(1)
      expect(wrapper?.text()).toContain('43')
      expect(wrapper?.find('[data-testid="top-liked-badge"]').text()).toContain('#3')
    })
  })
})
