import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import PackageSelector from '~/components/compare/PackageSelector.vue'

// Mock $fetch for useNpmSearch
const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)

describe('PackageSelector', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      objects: [
        { package: { name: 'lodash', description: 'Lodash modular utilities' } },
        { package: { name: 'underscore', description: 'JavaScript utility library' } },
      ],
      total: 2,
      time: new Date().toISOString(),
    })
  })

  describe('selected packages display', () => {
    it('renders selected packages as chips', async () => {
      const packages = ref(['lodash', 'underscore'])
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: packages.value,
        },
      })

      expect(component.text()).toContain('lodash')
      expect(component.text()).toContain('underscore')
    })

    it('renders package names as links', async () => {
      const packages = ref(['lodash'])
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: packages.value,
        },
      })

      const link = component.find('a[href="/lodash"]')
      expect(link.exists()).toBe(true)
    })

    it('renders remove button for each package', async () => {
      const packages = ref(['lodash', 'underscore'])
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: packages.value,
        },
      })

      const removeButtons = component
        .findAll('button')
        .filter(b => b.find('.i-carbon\\:close').exists())
      expect(removeButtons.length).toBe(2)
    })

    it('emits update when remove button is clicked', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['lodash', 'underscore'],
        },
      })

      const removeButton = component
        .findAll('button')
        .find(b => b.find('.i-carbon\\:close').exists())
      await removeButton!.trigger('click')

      const emitted = component.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted![0]![0]).toEqual(['underscore'])
    })
  })

  describe('search input', () => {
    it('renders search input when under max packages', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['lodash'],
          max: 4,
        },
      })

      expect(component.find('input[type="text"]').exists()).toBe(true)
    })

    it('hides search input when at max packages', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['a', 'b', 'c', 'd'],
          max: 4,
        },
      })

      expect(component.find('input[type="text"]').exists()).toBe(false)
    })

    it('shows different placeholder for first vs additional packages', async () => {
      // Empty state
      let component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: [],
        },
      })
      let input = component.find('input')
      expect(input.attributes('placeholder')).toBeTruthy()

      // With packages
      component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['lodash'],
        },
      })
      input = component.find('input')
      expect(input.attributes('placeholder')).toBeTruthy()
    })

    it('has search icon', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: [],
        },
      })

      expect(component.find('.i-carbon\\:search').exists()).toBe(true)
    })
  })

  describe('adding packages', () => {
    it('adds package on Enter key', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: [],
        },
      })

      const input = component.find('input')
      await input.setValue('my-package')
      await input.trigger('keydown', { key: 'Enter' })

      const emitted = component.emitted('update:modelValue')
      expect(emitted).toBeTruthy()
      expect(emitted![0]![0]).toEqual(['my-package'])
    })

    it('clears input after adding package', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: [],
        },
      })

      const input = component.find('input')
      await input.setValue('my-package')
      await input.trigger('keydown', { key: 'Enter' })

      // Input should be cleared
      expect((input.element as HTMLInputElement).value).toBe('')
    })

    it('does not add duplicate packages', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['lodash'],
        },
      })

      const input = component.find('input')
      await input.setValue('lodash')
      await input.trigger('keydown', { key: 'Enter' })

      const emitted = component.emitted('update:modelValue')
      // Should not emit since lodash is already selected
      expect(emitted).toBeFalsy()
    })

    it('respects max packages limit', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['a', 'b', 'c', 'd'],
          max: 4,
        },
      })

      // Input should not be visible
      expect(component.find('input').exists()).toBe(false)
    })
  })

  describe('hint text', () => {
    it('shows packages selected count', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['lodash', 'underscore'],
          max: 4,
        },
      })

      expect(component.text()).toContain('2')
      expect(component.text()).toContain('4')
    })

    it('shows add hint when less than 2 packages', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: ['lodash'],
          max: 4,
        },
      })

      // Should have hint about adding more
      expect(component.text().toLowerCase()).toContain('add')
    })
  })

  describe('max prop', () => {
    it('defaults to 4 when not provided', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: [],
        },
      })

      // Should show max of 4 in hint
      expect(component.text()).toContain('4')
    })

    it('uses provided max value', async () => {
      const component = await mountSuspended(PackageSelector, {
        props: {
          modelValue: [],
          max: 3,
        },
      })

      expect(component.text()).toContain('3')
    })
  })
})
