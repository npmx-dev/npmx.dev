import { describe, expect, it } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { LinkBase } from '#components'

async function getPrefetchOn(to: string) {
  const wrapper = await mountSuspended(LinkBase, { props: { to }, slots: { default: () => 'x' } })
  return wrapper.findComponent({ name: 'NuxtLink' }).props('prefetchOn')
}

describe('LinkBase', () => {
  it('prefetches cached payload routes on interaction only', async () => {
    expect(await getPrefetchOn('/package/vue')).toBe('interaction')
    expect(await getPrefetchOn('/package/@vue/core/v/3.5.0')).toBe('interaction')
  })

  it('keeps the default prefetch behaviour for other routes', async () => {
    expect(await getPrefetchOn('/org/vue')).toBeUndefined()
    expect(await getPrefetchOn('/about')).toBeUndefined()
  })
})
