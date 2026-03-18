import { describe, expect, it } from 'vite-plus/test'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ComparisonGrid from '~/components/Compare/ComparisonGrid.vue'

function cols(...headers: string[]) {
  return headers.map(header => {
    const [name, version] = header.split('@')
    return { name: name!, version }
  })
}

describe('ComparisonGrid', () => {
  describe('header rendering', () => {
    it('renders column headers', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('lodash@4.17.21', 'underscore@1.13.6'),
        },
      })
      expect(component.text()).toContain('lodash')
      expect(component.text()).toContain('@4.17.21')
      expect(component.text()).toContain('underscore')
      expect(component.text()).toContain('@1.13.6')
    })

    it('renders correct number of header cells', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('pkg1', 'pkg2', 'pkg3'),
        },
      })
      const headerCells = component.findAll('.comparison-cell-header')
      expect(headerCells.length).toBe(3)
    })

    it('adds no-dep column when showNoDependency is true', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('vue', 'react'),
          showNoDependency: true,
        },
      })
      const headerCells = component.findAll('.comparison-cell-header')
      expect(headerCells.length).toBe(3)
      expect(component.find('.comparison-cell-nodep').exists()).toBe(true)
    })

    it('renders package name and version on separate clamped lines with a full title attribute', async () => {
      const longName = 'very-long-package-name@1.0.0-beta.1'
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols(longName, 'short'),
        },
      })

      const link = component.find(`a[title="${longName}"]`)
      expect(link.exists()).toBe(true)
      expect(link.attributes('title')).toBe(longName)
      expect(link.findAll('.line-clamp-1')).toHaveLength(2)
    })
  })

  describe('column layout', () => {
    it('sets --package-count to the number of package columns', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b'),
        },
      })
      const grid = component.find('.comparison-grid')
      expect(grid.attributes('style')).toContain('--package-count: 2')
    })

    it('includes the no-dependency column in --package-count', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b'),
          showNoDependency: true,
        },
      })
      const grid = component.find('.comparison-grid')
      expect(grid.attributes('style')).toContain('--package-count: 3')
    })

    it('supports four package columns with the generic grid layout', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b', 'c', 'd'),
        },
      })
      const grid = component.find('.comparison-grid')
      expect(grid.attributes('style')).toContain('--package-count: 4')
    })

    it('sets --package-count CSS variable', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b', 'c'),
        },
      })
      const grid = component.find('.comparison-grid')
      expect(grid.attributes('style')).toContain('--package-count: 3')
    })
  })

  describe('slot content', () => {
    it('renders default slot content', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b'),
        },
        slots: {
          default: '<div class="test-row">Row content</div>',
        },
      })
      expect(component.find('.test-row').exists()).toBe(true)
      expect(component.text()).toContain('Row content')
    })
  })
})
