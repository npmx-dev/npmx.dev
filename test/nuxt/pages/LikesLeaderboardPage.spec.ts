import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { createLikesLeaderboardEntry } from '~~/test/fixtures/likes-leaderboard'
import LikesLeaderboardPage from '~/pages/leaderboard/likes.vue'

describe('likes leaderboard page', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    // This page remounts the same useFetch source with different mocked responses
    // across tests, so reset Nuxt's async-data store between cases.
    clearNuxtData()
  })

  afterEach(() => {
    wrapper?.unmount()
  })

  it('renders ranked rows from the local leaderboard API', async () => {
    registerEndpoint('/api/leaderboard/likes', () => [
      createLikesLeaderboardEntry('vue', {
        rank: 1,
        totalLikes: 120,
        homepagePreviewUrl: 'https://images.example.com/vue-home.png',
        homepagePreviewWidth: 1200,
        homepagePreviewHeight: 630,
      }),
      createLikesLeaderboardEntry('@nuxt/kit', {
        rank: 2,
        totalLikes: 90,
      }),
      createLikesLeaderboardEntry('react', {
        rank: 3,
        totalLikes: 80,
      }),
      createLikesLeaderboardEntry('svelte', {
        rank: 4,
        totalLikes: 70,
        packageDescription: 'Cybernetically enhanced web apps.',
        weeklyDownloads: 700,
        homepageLogoUrl: 'https://images.example.com/svelte-logo.svg',
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      }),
    ])

    wrapper = await mountSuspended(LikesLeaderboardPage, {
      route: '/leaderboard/likes',
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('Likes Leaderboard')
      expect(wrapper?.text()).toContain('vue')
      expect(wrapper?.text()).toContain('@nuxt/kit')
      expect(wrapper?.text()).toContain('svelte')
      expect(wrapper?.text()).toContain('Cybernetically enhanced web apps.')
      expect(wrapper?.text()).toContain('700/wk')
    })

    expect(wrapper.text()).toContain('#1')
    expect(wrapper.find('img[src="https://images.example.com/vue-home.png"]').exists()).toBe(true)
    expect(
      wrapper
        .find('[data-testid="likes-leaderboard-desktop-podium"]')
        .findAll('a')
        .map(link => link.attributes('href')),
    ).toEqual(['/package/vue', '/package/@nuxt/kit', '/package/react'])
    expect(wrapper.find('img[src="https://images.example.com/svelte-logo.svg"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('a[href="/package/svelte"]').exists()).toBe(true)
  })

  it('renders the unavailable state when the local leaderboard API is unavailable', async () => {
    registerEndpoint('/api/leaderboard/likes', () => [])

    wrapper = await mountSuspended(LikesLeaderboardPage, {
      route: '/leaderboard/likes',
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('No likes leaderboard yet')
    })

    expect(wrapper.text()).toContain("We don't have a likes leaderboard to show right now.")
  })
})
