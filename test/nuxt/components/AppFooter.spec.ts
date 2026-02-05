import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppFooter from '~/components/AppFooter.vue'

describe('AppFooter', () => {
  it('BuildEnvironment is properly displayed at settings', async () => {
    const buildInfo = useAppConfig().buildInfo
    const component = await mountSuspended(AppFooter, {
      route: '/settings',
    })
    const html = component.html()
    expect(html).toContain(`<span class="tracking-wider">${buildInfo.env}</span>`)
    expect(html).toContain(
      `<a href="https://github.com/npmx-dev/npmx.dev/commit/${buildInfo.commit}"`,
    )
  })

  it('BuildEnvironment is hidden at home', async () => {
    const buildInfo = useAppConfig().buildInfo
    const component = await mountSuspended(AppFooter, {
      route: '/',
    })
    const html = component.html()
    expect(html).not.toContain(
      `<a href="https://github.com/npmx-dev/npmx.dev/commit/${buildInfo.commit}"`,
    )
    expect(html).not.toContain(`<span class="tracking-wider">${buildInfo.env}</span>`)
  })
})
