import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ComparisonGrid from '~/components/Compare/ComparisonGrid.vue'

function cols(...headers: string[]) {
  return headers.map(header => ({ header }))
}

describe('ComparisonGrid', () => {
  describe('header rendering', () => {
    it('renders column headers', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('lodash@4.17.21', 'underscore@1.13.6'),
        },
      })
      expect(component.text()).toContain('lodash@4.17.21')
      expect(component.text()).toContain('underscore@1.13.6')
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

    it('truncates long header text with title attribute', async () => {
      const longName = 'very-long-package-name@1.0.0-beta.1'
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols(longName, 'short'),
        },
      })
      const links = component.findAll('a.truncate')
      const longLink = links.find(a => a.text() === longName)
      expect(longLink?.attributes('title')).toBe(longName)
    })
  })

  describe('column layout', () => {
    it('applies columns-2 class for 2 columns', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b'),
        },
      })
      expect(component.find('.columns-2').exists()).toBe(true)
    })

    it('applies columns-3 class for 2 packages + no-dep', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b'),
          showNoDependency: true,
        },
      })
      expect(component.find('.columns-3').exists()).toBe(true)
    })

    it('applies columns-4 class for 4 columns', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b', 'c', 'd'),
        },
      })
      expect(component.find('.columns-4').exists()).toBe(true)
    })

    it('sets min-width for 4 columns to 800px', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b', 'c', 'd'),
        },
      })
      expect(component.find('.min-w-\\[800px\\]').exists()).toBe(true)
    })

    it('sets min-width for 2-3 columns to 600px', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b'),
        },
      })
      expect(component.find('.min-w-\\[600px\\]').exists()).toBe(true)
    })

    it('sets --columns CSS variable', async () => {
      const component = await mountSuspended(ComparisonGrid, {
        props: {
          columns: cols('a', 'b', 'c'),
        },
      })
      const grid = component.find('.comparison-grid')
      expect(grid.attributes('style')).toContain('--columns: 3')
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
