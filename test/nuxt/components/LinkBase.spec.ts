import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import LinkBase from '~/components/Link/Base.vue'

describe('LinkBase', () => {
  it('renders a default text link with inline layout and medium size', async () => {
    const wrapper = await mountSuspended(LinkBase, {
      props: { to: '/about' },
      slots: { default: 'About' },
    })

    const link = wrapper.get('a')
    expect(link.classes()).toContain('inline-flex')
    expect(link.classes()).toContain('text-base')
    expect(link.classes()).toContain('underline')
  })

  it('uses flex layout and small text size when inline is false', async () => {
    const wrapper = await mountSuspended(LinkBase, {
      props: { to: '/settings', size: 'sm', inline: false },
      slots: { default: 'Settings' },
    })

    const link = wrapper.get('a')
    expect(link.classes()).toContain('flex')
    expect(link.classes()).toContain('text-sm')
  })

  it('applies extra-small text size for links', async () => {
    const wrapper = await mountSuspended(LinkBase, {
      props: { to: '/compare', size: 'xs' },
      slots: { default: 'Compare' },
    })

    const link = wrapper.get('a')
    expect(link.classes()).toContain('text-xs')
  })

  it('styles button links with size classes and no underline', async () => {
    const wrapper = await mountSuspended(LinkBase, {
      props: { to: '/compare', type: 'button', size: 'lg' },
      slots: { default: 'Compare' },
    })

    const link = wrapper.get('a')
    expect(link.classes()).toContain('border')
    expect(link.classes()).toContain('rounded-md')
    expect(link.classes()).toContain('text-lg')
    expect(link.classes()).toContain('px-6')
    expect(link.classes()).toContain('py-3')
    expect(link.classes()).not.toContain('underline')
  })
})
