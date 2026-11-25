import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { effectScope } from 'vue'
import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'
import Likes from '~/components/Package/Likes.vue'
import { useAtproto } from '~/composables/atproto/useAtproto'
import {
  clearClientSessionHintCookie,
  initSessionHintMigration,
} from '~/utils/atproto/session-hint'

function createAtprotoUser(handle: string) {
  return {
    did: `did:plc:${handle}`,
    handle,
    pds: 'https://bsky.social',
  }
}

let authSessionHandler: () => unknown = () => null
let authSessionDeleteHandler: () => unknown = () => 'Session cleared'

registerEndpoint('/api/auth/session', {
  method: 'GET',
  handler: () => authSessionHandler(),
})

registerEndpoint('/api/auth/session', {
  method: 'DELETE',
  handler: () => authSessionDeleteHandler(),
})

describe('PackageLikes', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    clearNuxtData()
    clearClientSessionHintCookie()
    localStorage.clear()
    initSessionHintMigration()
    authSessionHandler = () => null
    authSessionDeleteHandler = () => 'Session cleared'
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    clearNuxtData()
    clearClientSessionHintCookie()
    localStorage.clear()
    initSessionHintMigration()
  })

  it('renders the top liked badge with rank and skips per-user status for anonymous visitors', async () => {
    let statusRequests = 0

    registerEndpoint('/api/social/likes/vue', () => ({
      totalLikes: 42,
      topLikedRank: 3,
    }))
    registerEndpoint('/api/social/like-status/vue', () => {
      statusRequests++
      return { userHasLiked: false }
    })
    registerEndpoint('/api/social/likes/nuxt', () => ({
      totalLikes: 99,
      topLikedRank: 1,
    }))
    registerEndpoint('/api/social/like-status/nuxt', () => {
      statusRequests++
      return { userHasLiked: false }
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'vue' },
      attachTo: document.body,
    })

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
    expect(statusRequests).toBe(0)

    await wrapper.setProps({ packageName: 'nuxt' })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('99')
    })

    expect(statusRequests).toBe(0)
  })

  it('does not render the top liked badge when rank is unavailable', async () => {
    registerEndpoint('/api/social/likes/react', () => ({
      totalLikes: 42,
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

  it('fetches per-user like status when the hint cookie is present and keeps the count consistent across likes, unlikes, and stale cached reloads', async () => {
    let statusRequests = 0
    let likePostRequests = 0
    let likeDeleteRequests = 0
    let serverTotalLikes = 42
    let serverUserHasLiked = false

    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()
    authSessionHandler = () => createAtprotoUser('tester.test')

    registerEndpoint('/api/social/likes/svelte', () => ({
      totalLikes: 42,
      topLikedRank: 3,
    }))
    registerEndpoint('/api/social/like-status/svelte', () => {
      statusRequests++
      return {
        userHasLiked: serverUserHasLiked,
        totalLikes: serverTotalLikes,
      }
    })
    registerEndpoint('/api/social/like', {
      method: 'POST',
      handler: () => {
        likePostRequests++
        serverTotalLikes = 43
        serverUserHasLiked = true
        return {
          totalLikes: serverTotalLikes,
          userHasLiked: serverUserHasLiked,
          topLikedRank: null,
        }
      },
    })
    registerEndpoint('/api/social/like', {
      method: 'DELETE',
      handler: () => {
        likeDeleteRequests++
        serverTotalLikes = 42
        serverUserHasLiked = false
        return {
          totalLikes: serverTotalLikes,
          userHasLiked: serverUserHasLiked,
          topLikedRank: null,
        }
      },
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'svelte' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(statusRequests).toBe(1)
      expect(wrapper?.find('[data-testid="top-liked-badge"]').text()).toContain('#3')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
    })

    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => {
      expect(likePostRequests).toBe(1)
      expect(wrapper?.text()).toContain('43')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('true')
      expect(wrapper?.find('[data-testid="top-liked-badge"]').text()).toContain('#3')
    })

    wrapper.unmount()
    clearNuxtData()

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'svelte' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(statusRequests).toBe(2)
      expect(wrapper?.text()).toContain('43')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('true')
      expect(wrapper?.find('[data-testid="top-liked-badge"]').text()).toContain('#3')
    })

    await wrapper.get('button').trigger('click')

    await vi.waitFor(() => {
      expect(likeDeleteRequests).toBe(1)
      expect(wrapper?.text()).toContain('42')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
    })
  })

  it('reverts optimistic state when toggling a like fails', async () => {
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()
    authSessionHandler = () => createAtprotoUser('tester.test')

    let finishRequest!: () => void
    const pendingResponse = new Promise<void>(resolve => {
      finishRequest = resolve
    })
    let postRequests = 0

    registerEndpoint('/api/social/likes/vite', () => ({
      totalLikes: 10,
      topLikedRank: null,
    }))
    registerEndpoint('/api/social/like-status/vite', () => ({
      userHasLiked: false,
      totalLikes: 10,
    }))
    registerEndpoint('/api/social/like', {
      method: 'POST',
      handler: async () => {
        postRequests++
        await pendingResponse
        throw createError({ statusCode: 500, statusMessage: 'Failed' })
      },
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'vite' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('10')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
    })

    await wrapper.get('button').trigger('click')
    try {
      await vi.waitFor(() => {
        expect(postRequests).toBe(1)
        expect(wrapper?.text()).toContain('11')
        expect(wrapper?.get('button').attributes('aria-pressed')).toBe('true')
      })
    } finally {
      finishRequest()
    }

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('10')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
    })
  })

  it('ignores a late like response after the user logs out', async () => {
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()
    authSessionHandler = () => createAtprotoUser('tester.test')

    let finishRequest!: () => void
    const pendingResponse = new Promise<void>(resolve => {
      finishRequest = resolve
    })
    let postRequests = 0

    registerEndpoint('/api/social/likes/rolldown', () => ({
      totalLikes: 10,
      topLikedRank: null,
    }))
    registerEndpoint('/api/social/like-status/rolldown', () => ({
      userHasLiked: false,
      totalLikes: 10,
    }))
    registerEndpoint('/api/social/like', {
      method: 'POST',
      handler: async () => {
        postRequests++
        await pendingResponse
        return {
          totalLikes: 11,
          userHasLiked: true,
          topLikedRank: null,
        }
      },
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'rolldown' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('10')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
    })

    await wrapper.get('button').trigger('click')

    try {
      await vi.waitFor(() => {
        expect(postRequests).toBe(1)
        expect(wrapper?.get('button').attributes('aria-pressed')).toBe('true')
      })

      const scope = effectScope()
      try {
        await scope.run(() => useAtproto())!.logout()
      } finally {
        scope.stop()
      }

      await vi.waitFor(() => {
        expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
        expect(wrapper?.text()).toContain('10')
      })
    } finally {
      finishRequest()
    }

    await new Promise(resolve => setTimeout(resolve, 20))
    expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
    expect(wrapper?.text()).toContain('10')
  })

  it('fetches per-user status after a migration session resolves and clears it on logout', async () => {
    let statusRequests = 0
    localStorage.clear()
    localStorage.setItem('npmx-settings', JSON.stringify({ relativeDates: false }))
    initSessionHintMigration()
    authSessionHandler = () => createAtprotoUser('migrated.test')

    registerEndpoint('/api/social/likes/vitest', () => ({
      totalLikes: 20,
      topLikedRank: null,
    }))
    registerEndpoint('/api/social/like-status/vitest', () => {
      statusRequests++
      return {
        userHasLiked: true,
        totalLikes: 21,
      }
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'vitest' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(statusRequests).toBe(1)
      expect(wrapper?.text()).toContain('21')
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('true')
    })

    const scope = effectScope()
    try {
      await scope.run(() => useAtproto())!.logout()
    } finally {
      scope.stop()
    }

    await vi.waitFor(() => {
      expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
      expect(wrapper?.text()).toContain('20')
    })
  })

  it('keeps multiple mounted controls for the same package in sync across toggles', async () => {
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()
    authSessionHandler = () => createAtprotoUser('tester.test')

    registerEndpoint('/api/social/likes/unstorage', () => ({
      totalLikes: 5,
      topLikedRank: null,
    }))
    registerEndpoint('/api/social/like-status/unstorage', () => ({
      userHasLiked: false,
      totalLikes: 5,
    }))
    registerEndpoint('/api/social/like', {
      method: 'POST',
      handler: () => ({
        totalLikes: 6,
        userHasLiked: true,
        topLikedRank: null,
      }),
    })
    registerEndpoint('/api/social/like', {
      method: 'DELETE',
      handler: () => ({
        totalLikes: 5,
        userHasLiked: false,
        topLikedRank: null,
      }),
    })

    wrapper = await mountSuspended(Likes, {
      props: { packageName: 'unstorage' },
      attachTo: document.body,
    })
    const secondWrapper = await mountSuspended(Likes, {
      props: { packageName: 'unstorage' },
      attachTo: document.body,
    })

    try {
      await vi.waitFor(() => {
        expect(wrapper?.text()).toContain('5')
        expect(secondWrapper.text()).toContain('5')
      })

      await wrapper.get('button').trigger('click')

      await vi.waitFor(() => {
        expect(wrapper?.text()).toContain('6')
        expect(wrapper?.get('button').attributes('aria-pressed')).toBe('true')
        expect(secondWrapper.text()).toContain('6')
        expect(secondWrapper.get('button').attributes('aria-pressed')).toBe('true')
      })

      await secondWrapper.get('button').trigger('click')

      await vi.waitFor(() => {
        expect(wrapper?.text()).toContain('5')
        expect(wrapper?.get('button').attributes('aria-pressed')).toBe('false')
        expect(secondWrapper.text()).toContain('5')
        expect(secondWrapper.get('button').attributes('aria-pressed')).toBe('false')
      })
    } finally {
      secondWrapper.unmount()
    }
  })
})
