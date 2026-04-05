import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import Sidebar from '~/components/Package/Sidebar.vue'

const VIEWPORT_HEIGHT = window.innerHeight

function mountSidebar(contentHeight?: number) {
  return mountSuspended(Sidebar, {
    attachTo: document.body,
    slots: contentHeight
      ? { default: () => h('div', { style: `height:${contentHeight}px` }) }
      : { default: () => 'Sidebar Content' },
  })
}

describe('PackageSidebar', () => {
  let wrapper: VueWrapper

  afterEach(() => {
    wrapper?.unmount()
  })

  it('renders slot content', async () => {
    wrapper = await mountSidebar()

    expect(wrapper.text()).toContain('Sidebar Content')
  })

  it('sets active=false when content is shorter than viewport', async () => {
    wrapper = await mountSidebar(100)

    expect(wrapper.attributes('data-active')).toBe('false')
  })

  it('sets active=true when content is taller than viewport', async () => {
    wrapper = await mountSidebar(VIEWPORT_HEIGHT + 500)
    await nextTick()

    expect(wrapper.attributes('data-active')).toBe('true')
  })

  it('renders with direction=up by default', async () => {
    wrapper = await mountSidebar()

    expect(wrapper.attributes('data-direction')).toBe('up')
  })
})
