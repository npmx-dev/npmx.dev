import type { VueWrapper } from '@vue/test-utils'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import SocialMentions from '~/components/Package/SocialMentions.vue'

describe('PackageSocialMentions', () => {
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    clearNuxtData()
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
  })

  it('shows a spinner instead of 0 while loading', async () => {
    let resolveMentions!: (value: { totalMentions: number }) => void
    registerEndpoint(
      '/api/social/mentions/loading-pkg',
      () =>
        new Promise<{ totalMentions: number }>(resolve => {
          resolveMentions = resolve
        }),
    )

    wrapper = await mountSuspended(SocialMentions, {
      props: { packageName: 'loading-pkg' },
      attachTo: document.body,
    })

    const link = wrapper.get('[data-testid="social-mentions"]')
    expect(link.find('[class*="ring-resize"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('0 mentions')
    expect(link.attributes('aria-label')).toBe('Loading...')

    resolveMentions({ totalMentions: 5 })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('5 mentions')
    })
  })

  it('shows 0 mentions after loading resolves with zero', async () => {
    registerEndpoint('/api/social/mentions/zero-pkg', () => ({ totalMentions: 0 }))

    wrapper = await mountSuspended(SocialMentions, {
      props: { packageName: 'zero-pkg' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('0 mentions')
    })
  })

  it('links to the exact npmx.dev package URL search', async () => {
    registerEndpoint('/api/social/mentions/vue', () => ({ totalMentions: 12 }))

    wrapper = await mountSuspended(SocialMentions, {
      props: { packageName: 'vue' },
      attachTo: document.body,
    })

    await vi.waitFor(() => {
      expect(wrapper?.text()).toContain('12 mentions')
    })

    const link = wrapper.get('[data-testid="social-mentions"]')
    expect(link.attributes('href')).toBe(
      `https://bsky.app/search?q=${encodeURIComponent('https://npmx.dev/package/vue')}`,
    )
    expect(link.attributes('aria-label')).toBe('12 mentions')
  })
})
