import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import DateTime from '~/components/DateTime.vue'

// Mock the useRelativeDates composable
const mockRelativeDates = ref(false)
vi.mock('~/composables/useSettings', () => ({
  useRelativeDates: () => mockRelativeDates,
  useSettings: () => ({
    settings: ref({ relativeDates: mockRelativeDates.value }),
  }),
  useAccentColor: () => ({}),
  initAccentOnPrehydrate: () => {},
}))

describe('DateTime', () => {
  const testDate = '2024-01-15T12:00:00.000Z'
  const testDateObject = new Date('2024-06-15T10:30:00.000Z')
  const testYear = testDateObject.getUTCFullYear()

  beforeEach(() => {
    mockRelativeDates.value = false
  })

  describe('props handling', () => {
    it('accepts datetime as ISO string', async () => {
      const component = await mountSuspended(DateTime, {
        props: { datetime: testDate },
      })
      expect(component.html()).toContain('time')
    })

    it('accepts datetime as Date object', async () => {
      const component = await mountSuspended(DateTime, {
        props: { datetime: testDateObject },
      })
      expect(component.html()).toContain('time')
    })

    it('passes date-style prop to NuxtTime', async () => {
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: testDate,
          dateStyle: 'medium',
        },
      })
      // The component should render with the specified dateStyle
      expect(component.html()).toBeTruthy()
    })

    it('passes individual date parts to NuxtTime', async () => {
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: testDate,
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        },
      })
      expect(component.html()).toBeTruthy()
    })
  })

  describe('title attribute', () => {
    it('has title with formatted date by default', async () => {
      const component = await mountSuspended(DateTime, {
        props: { datetime: testDate },
      })
      const timeEl = component.find('time')
      expect(timeEl.attributes('title')).toContain(testYear)
    })

    it('uses custom title when provided', async () => {
      const customTitle = 'Custom date title'
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: testDate,
          title: customTitle,
        },
      })
      const timeEl = component.find('time')
      expect(timeEl.attributes('title')).toBe(customTitle)
    })

    it('converts Date object to formatted date in title', async () => {
      const component = await mountSuspended(DateTime, {
        props: { datetime: testDateObject },
      })
      const timeEl = component.find('time')
      expect(timeEl.attributes('title')).toContain(testYear)
    })
  })

  describe('relative dates setting', () => {
    it('renders absolute date when relativeDates is false', async () => {
      mockRelativeDates.value = false
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: testDate,
          dateStyle: 'medium',
        },
      })
      // Should not have the "relative" attribute behavior
      // The NuxtTime component will render with date formatting
      expect(component.html()).toContain('time')
    })

    it('renders with relative prop when relativeDates is true', async () => {
      mockRelativeDates.value = true
      const component = await mountSuspended(DateTime, {
        props: { datetime: testDate },
      })
      // Component should still render a time element
      expect(component.html()).toContain('time')
    })

    it('always preserves title attribute for accessibility regardless of mode', async () => {
      // Test with relative dates off
      mockRelativeDates.value = false
      let component = await mountSuspended(DateTime, {
        props: { datetime: testDate },
      })
      expect(component.find('time').attributes('title')).toContain(testYear)

      // Test with relative dates on
      mockRelativeDates.value = true
      component = await mountSuspended(DateTime, {
        props: { datetime: testDate },
      })
      expect(component.find('time').attributes('title')).toContain(testYear)
    })
  })

  describe('SSR fallback', () => {
    it('renders time element in fallback (SSR) mode', async () => {
      // The ClientOnly component has a fallback slot for SSR
      // This test ensures the fallback renders correctly
      const component = await mountSuspended(DateTime, {
        props: {
          datetime: testDate,
          dateStyle: 'medium',
        },
      })
      // Should have a time element rendered
      expect(component.find('time').exists()).toBe(true)
    })
  })
})
