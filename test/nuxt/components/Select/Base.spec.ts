import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SelectBase from '~/components/Select/Base.vue'

describe('SelectBase', () => {
  describe('rendering', () => {
    it('renders native select with slot options', async () => {
      const component = await mountSuspended(SelectBase, {
        slots: {
          default:
            '<option value="option1">option 1</option><option value="option2">option 2</option>',
        },
      })
      const select = component.find('select')
      expect(select.exists()).toBe(true)
      expect(component.findAll('option')).toHaveLength(2)
    })

    it('renders with initial modelValue', async () => {
      const component = await mountSuspended(SelectBase, {
        props: { modelValue: 'option2' },
        slots: {
          default:
            '<option value="option1">option 1</option><option value="option2">option 2</option>',
        },
      })
      const select = component.find('select').element
      expect(select.value).toBe('option2')
    })

    it('renders without disabled attribute when disabled is false', async () => {
      const component = await mountSuspended(SelectBase, {
        props: { disabled: false },
        slots: { default: '<option value="option1">option 1</option>' },
      })
      const select = component.find('select')
      expect(select.attributes('disabled')).toBeUndefined()
    })

    it('renders disabled when disabled is true', async () => {
      const component = await mountSuspended(SelectBase, {
        props: { disabled: true },
        slots: { default: '<option value="option1">option 1</option>' },
      })
      const select = component.find('select').element
      expect(select.disabled).toBe(true)
    })
  })

  describe('v-model', () => {
    it('emits update:modelValue when selection changes', async () => {
      const component = await mountSuspended(SelectBase, {
        props: { modelValue: 'option1' },
        slots: {
          default:
            '<option value="option1">option 1</option><option value="option2">option 2</option>',
        },
      })
      const select = component.find('select')
      await select.setValue('option2')
      expect(component.emitted('update:modelValue')).toBeTruthy()
      expect(component.emitted('update:modelValue')?.at(-1)).toEqual(['option2'])
    })

    it('reflects modelValue prop changes', async () => {
      const component = await mountSuspended(SelectBase, {
        props: { modelValue: 'option1' },
        slots: {
          default:
            '<option value="option1">option 1</option><option value="option2">option 2</option>',
        },
      })
      await component.setProps({ modelValue: 'option2' })
      const select = component.find('select').element
      expect(select.value).toBe('option2')
    })
  })
})
