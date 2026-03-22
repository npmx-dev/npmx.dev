import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AppFooter from '~/components/AppFooter.vue'

/* check nuxt module at modules/build-env.ts */
describe('AppFooter', () => {
  it('renders three labeled columns: Product, Legal, Community', async () => {
    const component = await mountSuspended(AppFooter, {
      route: '/',
    })

    // All three column label spans should be present
    const columnLabels = component.findAll('span.tracking-wide')
    expect(columnLabels.length).toBeGreaterThanOrEqual(3)

    const labelTexts = columnLabels.map(span => span.text().toLowerCase())
    expect(labelTexts.some(t => t.includes('product'))).toBe(true)
    expect(labelTexts.some(t => t.includes('legal'))).toBe(true)
    expect(labelTexts.some(t => t.includes('community'))).toBe(true)
  })

  it('footer contains links expected in the Product column', async () => {
    const component = await mountSuspended(AppFooter, {
      route: '/about',
    })

    // The Product column should link to /about and /blog
    const aboutLink = component.find('a[href="/about"]')
    expect(aboutLink.exists()).toBe(true)
  })

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
