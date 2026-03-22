import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppHeader from '~/components/AppHeader.vue'

describe('AppHeader', () => {
  it('renders the header element', async () => {
    const wrapper = await mountSuspended(AppHeader, { route: '/' })
    expect(wrapper.find('header').exists()).toBe(true)
  })

  it('does not apply z-1 to the nav container (fixes Connect dropdown clipping)', async () => {
    const wrapper = await mountSuspended(AppHeader, { route: '/' })
    // Regression: z-1 on the nav container caused the package sub-header to render
    // above the Connect dropdown. The container must not have z-1.
    const nav = wrapper.find('nav')
    expect(nav.attributes('class') ?? '').not.toContain('z-1')
  })

  it('renders logo link when showLogo is true', async () => {
    const wrapper = await mountSuspended(AppHeader, {
      route: '/package/react',
      props: { showLogo: true },
    })
    const homeLink = wrapper.find('a[href="/"]')
    expect(homeLink.exists()).toBe(true)
  })
})
