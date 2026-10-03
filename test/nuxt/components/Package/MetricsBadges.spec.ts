import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import PackageMetricsBadges from '~/components/Package/MetricsBadges.vue'

describe('PackageMetricsBadges', () => {
  let wrapper: VueWrapper

  afterEach(() => wrapper?.unmount())

  it('renders the badges', async () => {
    registerEndpoint('/api/registry/analysis/ufo', () => ({
      moduleFormat: 'dual',
      types: { kind: 'included' },
    }))

    wrapper = await mountSuspended(PackageMetricsBadges, {
      props: { packageName: 'ufo' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('CJS')
    })

    const text = wrapper.text()
    expect(text).toContain('Types')
    expect(text).toContain('ESM')
    expect(text).toContain('CJS')
    expect(text).not.toContain('WASM')
  })

  it('renders the wasm label', async () => {
    registerEndpoint('/api/registry/analysis/swc-plugin-transform-webpack-context', () => ({
      moduleFormat: 'wasm',
    }))

    wrapper = await mountSuspended(PackageMetricsBadges, {
      props: { packageName: 'swc-plugin-transform-webpack-context' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('WASM')
    })

    const text = wrapper.text()
    expect(text).toContain('WASM')
    expect(text).not.toContain('ESM')
  })

  it('does not render the CJS label when no CJS', async () => {
    registerEndpoint('/api/registry/analysis/@nuxt/kit', () => ({
      moduleFormat: 'esm',
      types: { kind: 'included' },
    }))

    wrapper = await mountSuspended(PackageMetricsBadges, {
      props: { packageName: '@nuxt/kit' },
    })

    await vi.waitFor(() => {
      expect(wrapper.text()).not.toContain('CJS')
    })

    const text = wrapper.text()
    expect(text).toContain('Types')
    expect(text).toContain('ESM')
    expect(text).not.toContain('CJS')
    expect(text).not.toContain('WASM')
  })
})
