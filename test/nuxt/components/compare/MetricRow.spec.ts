import { describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MetricRow from '~/components/compare/MetricRow.vue'

// Mock useRelativeDates for DateTime component
vi.mock('~/composables/useSettings', () => ({
  useRelativeDates: () => ref(false),
  useSettings: () => ({
    settings: ref({ relativeDates: false }),
  }),
  useAccentColor: () => ({}),
  initAccentOnPrehydrate: () => {},
}))

describe('MetricRow', () => {
  const baseProps = {
    label: 'Downloads',
    values: [],
  }

  describe('label rendering', () => {
    it('renders the label', async () => {
      const component = await mountSuspended(MetricRow, {
        props: { ...baseProps, label: 'Weekly Downloads' },
      })
      expect(component.text()).toContain('Weekly Downloads')
    })

    it('renders description tooltip icon when provided', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          description: 'Number of downloads per week',
        },
      })
      expect(component.find('.i-carbon\\:information').exists()).toBe(true)
    })

    it('does not render description icon when not provided', async () => {
      const component = await mountSuspended(MetricRow, {
        props: baseProps,
      })
      expect(component.find('.i-carbon\\:information').exists()).toBe(false)
    })
  })

  describe('value rendering', () => {
    it('renders null values as dash', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [null, null],
        },
      })
      const cells = component.findAll('.comparison-cell')
      expect(cells.length).toBe(2)
      expect(component.text()).toContain('-')
    })

    it('renders metric values', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 1000, display: '1K', status: 'neutral' },
            { raw: 2000, display: '2K', status: 'neutral' },
          ],
        },
      })
      expect(component.text()).toContain('1K')
      expect(component.text()).toContain('2K')
    })

    it('renders loading state', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [null],
          loading: true,
        },
      })
      expect(component.find('.i-carbon\\:circle-dash').exists()).toBe(true)
    })
  })

  describe('status styling', () => {
    it('applies good status class', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [{ raw: 0, display: 'None', status: 'good' }],
        },
      })
      expect(component.find('.text-emerald-400').exists()).toBe(true)
    })

    it('applies warning status class', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [{ raw: 100, display: '100 MB', status: 'warning' }],
        },
      })
      expect(component.find('.text-amber-400').exists()).toBe(true)
    })

    it('applies bad status class', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [{ raw: 5, display: '5 critical', status: 'bad' }],
        },
      })
      expect(component.find('.text-red-400').exists()).toBe(true)
    })

    it('applies info status class', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [{ raw: '@types', display: '@types', status: 'info' }],
        },
      })
      expect(component.find('.text-blue-400').exists()).toBe(true)
    })
  })

  describe('bar visualization', () => {
    it('shows bar for numeric values when bar prop is true', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 100, display: '100', status: 'neutral' },
            { raw: 200, display: '200', status: 'neutral' },
          ],
          bar: true,
        },
      })
      // Bar elements have bg-fg/5 class
      expect(component.findAll('.bg-fg\\/5').length).toBeGreaterThan(0)
    })

    it('hides bar when bar prop is false', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 100, display: '100', status: 'neutral' },
            { raw: 200, display: '200', status: 'neutral' },
          ],
          bar: false,
        },
      })
      expect(component.findAll('.bg-fg\\/5').length).toBe(0)
    })

    it('does not show bar for non-numeric values', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 'MIT', display: 'MIT', status: 'neutral' },
            { raw: 'Apache-2.0', display: 'Apache-2.0', status: 'neutral' },
          ],
        },
      })
      expect(component.findAll('.bg-fg\\/5').length).toBe(0)
    })
  })

  describe('diff indicators', () => {
    it('renders diff with increase direction', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 100, display: '100', status: 'neutral' },
            { raw: 200, display: '200', status: 'neutral' },
          ],
          diffs: [null, { direction: 'increase', display: '+100%', favorable: true }],
        },
      })
      expect(component.find('.i-carbon\\:arrow-up').exists()).toBe(true)
      expect(component.text()).toContain('+100%')
    })

    it('renders diff with decrease direction', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 200, display: '200', status: 'neutral' },
            { raw: 100, display: '100', status: 'neutral' },
          ],
          diffs: [null, { direction: 'decrease', display: '-50%', favorable: false }],
        },
      })
      expect(component.find('.i-carbon\\:arrow-down').exists()).toBe(true)
    })

    it('applies favorable diff styling (green)', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 100, display: '100', status: 'neutral' },
            { raw: 50, display: '50', status: 'neutral' },
          ],
          diffs: [null, { direction: 'decrease', display: '-50%', favorable: true }],
        },
      })
      expect(component.find('.text-emerald-400').exists()).toBe(true)
    })

    it('applies unfavorable diff styling (red)', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 100, display: '100', status: 'neutral' },
            { raw: 200, display: '200', status: 'neutral' },
          ],
          diffs: [null, { direction: 'increase', display: '+100%', favorable: false }],
        },
      })
      // Find the diff section with red styling
      const diffElements = component.findAll('.text-red-400')
      expect(diffElements.length).toBeGreaterThan(0)
    })

    it('does not render diff indicator for same direction', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 100, display: '100', status: 'neutral' },
            { raw: 100, display: '100', status: 'neutral' },
          ],
          diffs: [null, { direction: 'same', display: '0%', favorable: undefined }],
        },
      })
      expect(component.find('.i-carbon\\:arrow-up').exists()).toBe(false)
      expect(component.find('.i-carbon\\:arrow-down').exists()).toBe(false)
    })
  })

  describe('date values', () => {
    it('renders DateTime component for date type values', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            {
              raw: Date.now(),
              display: '2024-01-15T12:00:00.000Z',
              status: 'neutral',
              type: 'date',
            },
          ],
          bar: false, // Disable bar for date values
        },
      })
      // DateTime component renders a time element
      expect(component.find('time').exists()).toBe(true)
    })
  })

  describe('grid layout', () => {
    it('uses contents display for grid integration', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [{ raw: 100, display: '100', status: 'neutral' }],
        },
      })
      expect(component.find('.contents').exists()).toBe(true)
    })

    it('renders correct number of cells for values', async () => {
      const component = await mountSuspended(MetricRow, {
        props: {
          ...baseProps,
          values: [
            { raw: 1, display: '1', status: 'neutral' },
            { raw: 2, display: '2', status: 'neutral' },
            { raw: 3, display: '3', status: 'neutral' },
          ],
        },
      })
      // 1 label cell + 3 value cells
      const cells = component.findAll('.comparison-cell')
      expect(cells.length).toBe(3)
    })
  })
})
