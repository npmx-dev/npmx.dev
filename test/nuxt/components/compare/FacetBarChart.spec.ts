import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import FacetBarChart from '~/components/Compare/FacetBarChart.vue'

describe('FacetBarChart', () => {
  it('renders a taller loading skeleton with title and subtitle placeholders', async () => {
    const component = await mountSuspended(FacetBarChart, {
      props: {
        values: [null, null],
        packages: ['react', 'vue'],
        label: 'Bundle size',
        description: 'Compare install footprint',
        facetLoading: true,
      },
    })

    const skeleton = component.find('[data-test="facet-bar-chart-skeleton"]')
    expect(skeleton.exists()).toBe(true)

    const lines = skeleton.findAllComponents({ name: 'SkeletonInline' })
    expect(lines).toHaveLength(4)
    expect(lines[0]?.attributes('class')).toContain('h-5')
    expect(lines[1]?.attributes('class')).toContain('h-4')
    expect(lines[2]?.attributes('class')).toContain('h-8')
    expect(lines[3]?.attributes('class')).toContain('h-8')
  })
})
