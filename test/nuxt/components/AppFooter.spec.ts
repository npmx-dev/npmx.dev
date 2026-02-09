import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppFooter from '~/components/AppFooter.vue'

/* check nuxt module at modules/build-env.ts */
describe('AppFooter', () => {
  it('BuildEnvironment is properly displayed at settings', async () => {
    const buildInfo = useAppConfig().buildInfo
    const component = await mountSuspended(AppFooter, {
      route: '/settings',
    })

    const envSpan = component.find('span.tracking-wider')
    expect(envSpan.exists()).toBe(true)
    expect(envSpan.text()).toBe(buildInfo.env)
    const commitLink = component.find(`a[href$="/commit/${buildInfo.commit}"]`)
    expect(commitLink.exists()).toBe(true)
    const tagLink = component.find(`a[href$="/tag/v${buildInfo.version}"]`)
    expect(tagLink.exists()).toBe(false)
  })

  it('BuildEnvironment is hidden at home', async () => {
    const buildInfo = useAppConfig().buildInfo
    const component = await mountSuspended(AppFooter, {
      route: '/',
    })

    const envSpan = component.find('span.tracking-wider')
    expect(envSpan.exists()).toBe(false)
    const commitLink = component.find(`a[href$="/commit/${buildInfo.commit}"]`)
    expect(commitLink.exists()).toBe(false)
    const tagLink = component.find(`a[href$="/tag/v${buildInfo.version}"]`)
    expect(tagLink.exists()).toBe(false)
  })
})
