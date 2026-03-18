import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import SelectField from '~/components/Select/Field.vue'

const defaultItems = [
  { label: 'Option 1', value: 'option1' },
  { label: 'Option 2', value: 'option2' },
]

describe('SelectField', () => {
  describe('rendering', () => {
    it('renders options from items prop', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems },
      })
      const options = component.findAll('option')
      expect(options).toHaveLength(2)
      expect(options[0]?.text()).toBe('Option 1')
      expect(options[1]?.text()).toBe('Option 2')
      expect(options[0]?.attributes('value')).toBe('option1')
      expect(options[1]?.attributes('value')).toBe('option2')
    })

    it('renders label when provided', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems, label: 'Choose one' },
      })
      const label = component.find('label')
      expect(label.exists()).toBe(true)
      expect(label.text()).toBe('Choose one')
      expect(label.attributes('for')).toBe('select')
    })

    it('renders disabled option when item.disabled is true', async () => {
      const component = await mountSuspended(SelectField, {
        props: {
          id: 'select',
          items: [
            { label: 'Enabled', value: 'on' },
            { label: 'Disabled', value: 'off', disabled: true },
          ],
        },
      })
      const options = component.findAll('option')
      expect(options[1]?.element?.disabled).toBe(true)
    })

    it('applies block class when block is true', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems, block: true },
      })
      const wrapper = component.find('.relative')
      expect(wrapper.classes()).toContain('w-full')
      const select = component.find('select')
      expect(select.classes()).toContain('w-full')
    })
  })

  describe('v-model', () => {
    it('emits update:modelValue when option is selected', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems, modelValue: 'option1' },
      })
      const select = component.find('select')
      await select.setValue('option2')
      expect(component.emitted('update:modelValue')).toBeTruthy()
      expect(component.emitted('update:modelValue')?.at(-1)).toEqual(['option2'])
    })

    it('reflects modelValue prop changes', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems, modelValue: 'option1' },
      })
      await component.setProps({ modelValue: 'option2' })
      const select = component.find('select').element
      expect(select.value).toBe('option2')
    })
  })

  describe('disabled', () => {
    it('passes disabled to SelectBase', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems, disabled: true },
      })
      const select = component.find('select').element
      expect(select.disabled).toBe(true)
    })
  })

  describe('accessibility', () => {
    it('chevron has aria-hidden', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'select', items: defaultItems },
      })
      const chevron = component.find('span[aria-hidden="true"]')
      expect(chevron.exists()).toBe(true)
    })

    it('render sr-only label when hiddenLabel is true', async () => {
      const component = await mountSuspended(SelectField, {
        props: {
          id: 'select',
          items: defaultItems,
          label: 'Hidden',
          hiddenLabel: true,
        },
      })
      const label = component.find('label')
      expect(label.exists()).toBe(true)
      expect(label.classes()).toContain('sr-only')
      expect(label.text()).toBe('Hidden')
    })

    it('associates select with id', async () => {
      const component = await mountSuspended(SelectField, {
        props: { id: 'my-select', items: defaultItems, label: 'My Select' },
      })
      const select = component.find('select')
      expect(select.attributes('id')).toBe('my-select')
      const label = component.find('label')
      expect(label.attributes('for')).toBe('my-select')
    })
  })
})
