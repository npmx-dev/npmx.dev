import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from '#shared/utils/constants'
import LikeCard from '~/components/Package/LikeCard.vue'
import {
  clearClientSessionHintCookie,
  initSessionHintMigration,
} from '~/utils/atproto/session-hint'

let authSessionHandler: () => unknown = () => null

registerEndpoint('/api/auth/session', () => authSessionHandler())

describe('PackageLikeCard', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    clearNuxtData()
    clearClientSessionHintCookie()
    localStorage.clear()
    initSessionHintMigration()
    authSessionHandler = () => null
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    clearNuxtData()
    clearClientSessionHintCookie()
    localStorage.clear()
    initSessionHintMigration()
  })

  // oxlint-disable-next-line unicorn/consistent-function-scoping
  function mountLikeCard(packageUrl: string) {
    return mountSuspended(LikeCard, {
      props: { packageUrl },
      attachTo: document.body,
    })
  }

  it('renders the package name', async () => {
    wrapper = await mountLikeCard('https://npmx.dev/package/vue')

    expect(wrapper.text()).toContain('vue')
  })

  it('truncates a long package name instead of overflowing', async () => {
    const longName = 'a'.repeat(200)
    wrapper = await mountLikeCard(`https://npmx.dev/package/${longName}`)

    const nameEl = wrapper.find('span.truncate').element as HTMLElement
    expect(nameEl.scrollWidth).toBeGreaterThan(nameEl.clientWidth)
  })

  it('shows the full name in a title attribute on hover', async () => {
    const longName = 'a'.repeat(200)
    wrapper = await mountLikeCard(`https://npmx.dev/package/${longName}`)

    const nameEl = wrapper.find('span.truncate')
    expect(nameEl.attributes('title')).toBe(longName)
  })

  it('extracts scoped package name from URL', async () => {
    wrapper = await mountLikeCard('https://npmx.dev/package/@scope/pkg')

    expect(wrapper.find('span.truncate').text()).toBe('@scope/pkg')
  })

  it('hides the like button entirely while like data is pending', async () => {
    wrapper = await mountLikeCard('https://npmx.dev/package/vue')

    const button = wrapper.find('button')
    expect(button.exists()).toBe(false)
  })

  it('skips per-user like status for anonymous visitors', async () => {
    let statusRequests = 0
    registerEndpoint('/api/social/likes/pinia', () => ({
      totalLikes: 15,
      topLikedRank: null,
    }))
    registerEndpoint('/api/social/like-status/pinia', () => {
      statusRequests++
      return { userHasLiked: true, totalLikes: 15 }
    })

    wrapper = await mountLikeCard('https://npmx.dev/package/pinia')

    await vi.waitFor(() => {
      expect(wrapper?.find('button').exists()).toBe(true)
      expect(wrapper?.text()).toContain('15')
    })

    expect(statusRequests).toBe(0)
  })

  it('fetches per-user like status when the hint cookie is present', async () => {
    let statusRequests = 0
    document.cookie = `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}; Path=/`
    initSessionHintMigration()
    authSessionHandler = () => ({
      did: 'did:plc:tester',
      handle: 'tester.test',
      pds: 'https://bsky.social',
    })

    registerEndpoint('/api/social/likes/nitro', () => ({
      totalLikes: 7,
      topLikedRank: null,
    }))
    registerEndpoint('/api/social/like-status/nitro', () => {
      statusRequests++
      return { userHasLiked: true, totalLikes: 8 }
    })

    wrapper = await mountLikeCard('https://npmx.dev/package/nitro')

    await vi.waitFor(() => {
      expect(statusRequests).toBe(1)
      expect(wrapper?.find('button').exists()).toBe(true)
      expect(wrapper?.text()).toContain('8')
    })
  })
})
