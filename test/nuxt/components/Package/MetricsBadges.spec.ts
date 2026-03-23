import type { VueWrapper } from '@vue/test-utils'
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import PackageMetricsBadges from '~/components/Package/MetricsBadges.vue'

const { mockUsePackageAnalysis } = vi.hoisted(() => ({
  mockUsePackageAnalysis: vi.fn(),
}))

mockNuxtImport('usePackageAnalysis', () => mockUsePackageAnalysis)

describe('PackageMetricsBadges', () => {
  let wrapper: VueWrapper

  afterEach(() => wrapper?.unmount())

  it('renders the badges', async () => {
    mockUsePackageAnalysis.mockReturnValue({
      data: ref({ moduleFormat: 'dual', types: { kind: 'included' } }),
      status: ref('success'),
    })

    wrapper = await mountSuspended(PackageMetricsBadges, {
      props: { packageName: 'ufo' },
    })

    const text = wrapper.text()
    expect(text).toContain('Types')
    expect(text).toContain('ESM')
    expect(text).toContain('CJS')
    expect(text).not.toContain('WASM')
  })

  it('renders the wasm label', async () => {
    mockUsePackageAnalysis.mockReturnValue({
      data: ref({ moduleFormat: 'wasm' }),
      status: ref('success'),
    })

    wrapper = await mountSuspended(PackageMetricsBadges, {
      props: { packageName: 'swc-plugin-transform-webpack-context' },
    })

    const text = wrapper.text()
    expect(text).toContain('WASM')
    expect(text).not.toContain('ESM')
  })

  it('does not render the CJS label when no CJS', async () => {
    mockUsePackageAnalysis.mockReturnValue({
      data: ref({ moduleFormat: 'esm', types: { kind: 'included' } }),
      status: ref('success'),
    })

    wrapper = await mountSuspended(PackageMetricsBadges, {
      props: { packageName: '@nuxt/kit' },
    })

    const text = wrapper.text()
    expect(text).toContain('Types')
    expect(text).toContain('ESM')
    expect(text).not.toContain('CJS')
    expect(text).not.toContain('WASM')
  })
})
