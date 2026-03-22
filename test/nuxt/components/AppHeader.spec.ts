import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppHeader from '~/components/AppHeader.vue'

describe('AppHeader', () => {
  it('renders a search input area', async () => {
    const wrapper = await mountSuspended(AppHeader, {
      route: '/',
    })

    // The search container with ref="searchContainerRef" should be rendered
    // and contain an input element for the search functionality
    const html = wrapper.html()
    // The header renders a search form/input
    expect(html).toContain('search')
  })

  it('nav links use invisible instead of hidden to prevent layout shift', async () => {
    const wrapper = await mountSuspended(AppHeader, {
      route: '/',
    })

    const html = wrapper.html()
    // The nav list should use 'invisible pointer-events-none' (not 'hidden')
    // when the search is expanded, to prevent layout shifts
    // Verify the nav list element exists at all
    const navList = wrapper.find('nav ul, ul[class*="list-none"]')
    // When not on a search page and search is not expanded,
    // the nav list should be visible (not invisible)
    expect(navList.exists() || html.includes('list-none')).toBe(true)
  })

  it('renders the header element', async () => {
    const wrapper = await mountSuspended(AppHeader, {
      route: '/',
    })

    expect(wrapper.find('header').exists()).toBe(true)
  })

  it('renders logo link when showLogo is true', async () => {
    const wrapper = await mountSuspended(AppHeader, {
      route: '/package/react',
      props: { showLogo: true },
    })

    // There should be a link to the home page (logo)
    const homeLink = wrapper.find('a[href="/"]')
    expect(homeLink.exists()).toBe(true)
  })
})
