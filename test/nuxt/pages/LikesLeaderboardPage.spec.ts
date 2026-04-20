import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
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
      {
        rank: 1,
        packageName: 'vue',
        subjectRef: 'https://npmx.dev/package/vue',
        totalLikes: 120,
        packageDescription: 'The Progressive JavaScript Framework.',
        weeklyDownloads: 1200,
        repositoryStars: 208000,
        homepagePreviewUrl: 'https://images.example.com/vue-home.png',
        homepagePreviewWidth: 1200,
        homepagePreviewHeight: 630,
        homepageLogoUrl: 'https://images.example.com/vue-logo.svg',
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      },
      {
        rank: 2,
        packageName: '@nuxt/kit',
        subjectRef: 'https://npmx.dev/package/@nuxt/kit',
        totalLikes: 90,
        packageDescription: 'Nuxt internals for module authors.',
        weeklyDownloads: 900,
        repositoryStars: 59000,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: 'https://images.example.com/nuxt-logo.svg',
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      },
      {
        rank: 3,
        packageName: 'react',
        subjectRef: 'https://npmx.dev/package/react',
        totalLikes: 80,
        packageDescription: 'The library for web and native user interfaces.',
        weeklyDownloads: 800,
        repositoryStars: 230000,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: null,
        homepageLogoWidth: null,
        homepageLogoHeight: null,
      },
      {
        rank: 4,
        packageName: 'svelte',
        subjectRef: 'https://npmx.dev/package/svelte',
        totalLikes: 70,
        packageDescription: 'Cybernetically enhanced web apps.',
        weeklyDownloads: 700,
        repositoryStars: 82000,
        homepagePreviewUrl: null,
        homepagePreviewWidth: null,
        homepagePreviewHeight: null,
        homepageLogoUrl: 'https://images.example.com/svelte-logo.svg',
        homepageLogoWidth: 256,
        homepageLogoHeight: 256,
      },
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
