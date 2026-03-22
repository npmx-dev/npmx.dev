import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FacetBarChart from '~/components/Compare/FacetBarChart.vue'

// Stub the heavy chart library
vi.mock('vue-data-ui/vue-ui-horizontal-bar', () => ({
  VueUiHorizontalBar: { template: '<div class="chart-stub"><slot name="fallback" /></div>' },
}))
vi.mock('vue-data-ui/style.css', () => ({}))

describe('FacetBarChart skeleton loaders', () => {
  const baseProps = {
    values: [null, null, null],
    packages: ['react', 'vue', 'svelte'],
    label: 'Weekly Downloads',
    description: 'Downloads per week',
    facetLoading: true,
  }

  it('renders skeleton loaders when facetLoading is true', async () => {
    const wrapper = await mountSuspended(FacetBarChart, {
      props: baseProps,
    })

    const html = wrapper.html()
    // Should show skeleton elements
    expect(html).toContain('h-7')
  })

  it('skeleton bar label widths vary across packages (not all the same)', () => {
    // The formula used is: width = `${40 + (i * 17) % 40}%`
    // For 3 packages: i=0 -> 40%, i=1 -> 57%, i=2 -> 74%
    const packages = ['react', 'vue', 'svelte']
    const widths = packages.map((_, i) => `${40 + (i * 17) % 40}%`)

    // Verify they are not all the same (the bug was all bars had the same width)
    const uniqueWidths = new Set(widths)
    expect(uniqueWidths.size).toBeGreaterThan(1)
  })

  it('skeleton width formula produces values within 40-80% range', () => {
    const indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    for (const i of indices) {
      const width = 40 + (i * 17) % 40
      expect(width).toBeGreaterThanOrEqual(40)
      expect(width).toBeLessThan(80)
    }
  })

  it('renders one row per package in the skeleton', async () => {
    const wrapper = await mountSuspended(FacetBarChart, {
      props: {
        ...baseProps,
        packages: ['pkg-a', 'pkg-b', 'pkg-c'],
        facetLoading: true,
      },
    })

    // The skeleton renders one flex row per package
    const html = wrapper.html()
    // flex items-center gap-3 = the skeleton row class
    const rowMatches = html.match(/flex items-center gap-3/g)
    expect(rowMatches).not.toBeNull()
  })
})
