import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
      },
      {
        rank: 2,
        packageName: '@nuxt/kit',
        subjectRef: 'https://npmx.dev/package/@nuxt/kit',
        totalLikes: 90,
      },
    ])

    wrapper = await mountSuspended(LikesLeaderboardPage, {
      route: '/leaderboard/likes',
    })

    expect(wrapper.text()).toContain('Likes Leaderboard')
    expect(wrapper.text()).toContain('vue')
    expect(wrapper.text()).toContain('@nuxt/kit')
    expect(wrapper.text()).toContain('#1')
    expect(wrapper.find('a[href="/package/vue"]').exists()).toBe(true)
  })

  it('renders the unavailable state when the local leaderboard API is unavailable', async () => {
    registerEndpoint('/api/leaderboard/likes', () => [])

    wrapper = await mountSuspended(LikesLeaderboardPage, {
      route: '/leaderboard/likes',
    })

    expect(wrapper.text()).toContain('No likes leaderboard yet')
    expect(wrapper.text()).toContain("We don't have a likes leaderboard to show right now.")
  })
})
