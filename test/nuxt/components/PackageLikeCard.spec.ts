import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import LikeCard from '~/components/Package/LikeCard.vue'

describe('PackageLikeCard', () => {
  let wrapper: VueWrapper

  afterEach(() => {
    wrapper?.unmount()
  })

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
})
