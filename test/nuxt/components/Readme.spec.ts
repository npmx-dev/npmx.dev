import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Readme from '~/components/Readme.vue'

// Mock scrollToAnchor
vi.mock('~/utils/scrollToAnchor', () => ({
  scrollToAnchor: vi.fn(),
}))

import { scrollToAnchor } from '~/utils/scrollToAnchor'

describe('Readme', () => {
  describe('rendering', () => {
    it('renders the provided HTML content', async () => {
      const component = await mountSuspended(Readme, {
        props: { html: '<p>Hello world</p>' },
      })
      expect(component.html()).toContain('Hello world')
    })
  })

  describe('hash link click handling', () => {
    it('intercepts hash link clicks and calls scrollToAnchor with lowercase ID', async () => {
      const component = await mountSuspended(Readme, {
        props: { html: '<a href="#Installation">Installation</a>' },
      })

      const link = component.find('a')
      await link.trigger('click')

      expect(scrollToAnchor).toHaveBeenCalledWith('installation')
    })

    it('handles user-content prefixed hash links', async () => {
      vi.mocked(scrollToAnchor).mockClear()
      const component = await mountSuspended(Readme, {
        props: { html: '<a href="#user-content-getting-started">Getting Started</a>' },
      })

      const link = component.find('a')
      await link.trigger('click')

      expect(scrollToAnchor).toHaveBeenCalledWith('user-content-getting-started')
    })
  })
})
