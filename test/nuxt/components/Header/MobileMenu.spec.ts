import { describe, it, expect, vi } from 'vitest'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { computed, nextTick } from 'vue'
import { HeaderMobileMenu } from '#components'

// Mock useConnector
mockNuxtImport('useConnector', () => () => ({
  isConnected: computed(() => false),
  npmUser: computed(() => null),
  avatar: computed(() => null),
}))

// Mock useAtproto
mockNuxtImport('useAtproto', () => () => ({
  user: computed(() => null),
}))

// Mock useFocusTrap (from @vueuse/integrations)
vi.mock('@vueuse/integrations/useFocusTrap', () => ({
  useFocusTrap: () => ({
    activate: vi.fn(),
    deactivate: vi.fn(),
  }),
}))

describe('MobileMenu', () => {
  async function mountMenu(open = false) {
    return mountSuspended(HeaderMobileMenu, {
      props: {
        open,
        links: [
          {
            type: 'group' as const,
            name: 'main',
            label: 'Navigation',
            items: [
              {
                type: 'link' as const,
                name: 'home',
                label: 'Home',
                to: '/',
                iconClass: 'i-lucide:home',
              },
            ],
          },
        ],
      },
      attachTo: document.body,
    })
  }

  it('is closed by default', async () => {
    const wrapper = await mountMenu(false)
    try {
      // Menu content is behind v-if="isOpen" inside a Teleport
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })

  it('opens when the open prop is set to true', async () => {
    const wrapper = await mountMenu(true)
    try {
      await nextTick()
      const dialog = document.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      expect(dialog?.getAttribute('aria-modal')).toBe('true')
    } finally {
      wrapper.unmount()
    }
  })

  it('closes when open prop changes from true to false', async () => {
    const wrapper = await mountMenu(true)
    try {
      await nextTick()
      expect(document.querySelector('[role="dialog"]')).not.toBeNull()

      await wrapper.setProps({ open: false })
      await nextTick()
      expect(document.querySelector('[role="dialog"]')).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })

  it('emits update:open false when backdrop is clicked', async () => {
    const wrapper = await mountMenu(true)
    try {
      await nextTick()
      const backdrop = document.querySelector('[role="dialog"] > button')
      expect(backdrop).not.toBeNull()
      backdrop?.dispatchEvent(new Event('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('update:open')).toBeTruthy()
      expect(wrapper.emitted('update:open')![0]).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  })

  it('emits update:open false when close button is clicked', async () => {
    const wrapper = await mountMenu(true)
    try {
      await nextTick()
      // Close button has aria-label matching $t('common.close') — find it inside nav
      const closeBtn = document.querySelector('nav button[aria-label]')
      expect(closeBtn).not.toBeNull()
      closeBtn?.dispatchEvent(new Event('click', { bubbles: true }))
      await nextTick()
      expect(wrapper.emitted('update:open')).toBeTruthy()
      expect(wrapper.emitted('update:open')![0]).toEqual([false])
    } finally {
      wrapper.unmount()
    }
  })
})
