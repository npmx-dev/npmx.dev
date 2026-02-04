import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppFooter from '~/components/AppFooter.vue'

describe('AppFooter', () => {
  it('BuildEnvironment is properly displayed at settings', async () => {
    const component = await mountSuspended(AppFooter, {
      route: '/settings',
    })
    const html = component.html()
    expect(html).toContain('<span class="tracking-wider">dev</span>')
    expect(html).toContain(
      '<a href="https://github.com/npmx-dev/npmx.dev/commit/704987bba88909f3782d792c224bde989569acb9"',
    )
  })

  it('BuildEnvironment is hidden at home', async () => {
    const component = await mountSuspended(AppFooter, {
      route: '/',
    })
    const html = component.html()
    expect(html).not.toContain(
      '<a href="https://github.com/npmx-dev/npmx.dev/commit/704987bba88909f3782d792c224bde989569acb9"',
    )
    expect(html).not.toContain('<span class="tracking-wider">dev</span>')
  })
})
