import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import DateTimeButton from '~/components/DateTimeButton.vue'

// Mock the useRelativeDates composable
const mockRelativeDates = shallowRef(false)
vi.mock('~/composables/useSettings', () => ({
  useRelativeDates: () => ({
    relativeDates: mockRelativeDates,
  }),
  useSettings: () => ({
    settings: ref({ relativeDates: mockRelativeDates.value }),
  }),
  useAccentColor: () => ({}),
}))

describe('DateTimeButton', () => {
  const testDate = '2024-01-15T12:00:00.000Z'

  beforeEach(() => {
    mockRelativeDates.value = false
  })

  it('clicking button to toggle the relative dates settings', async () => {
    const component = await mountSuspended(DateTimeButton, {
      props: { datetime: testDate },
    })
    const button = component.find('button')

    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('true')

    await button.trigger('click')
    expect(button.attributes('aria-pressed')).toBe('false')
  })
})
