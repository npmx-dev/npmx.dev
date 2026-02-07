import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import InputBase from '~/components/Input/Base.vue'

describe('InputBase', () => {
  describe('rendering', () => {
    it('renders with default empty value', async () => {
      const component = await mountSuspended(InputBase)
      const input = component.find('input')
      expect((input.element as HTMLInputElement).value).toBe('')
    })

    it('renders with initial modelValue', async () => {
      const component = await mountSuspended(InputBase, {
        props: { modelValue: 'hello' },
      })
      const input = component.find('input')
      expect((input.element as HTMLInputElement).value).toBe('hello')
    })

    it('renders empty string when modelValue is undefined or null', async () => {
      const withUndefined = await mountSuspended(InputBase, {
        props: { modelValue: undefined },
      })
      expect((withUndefined.find('input').element as HTMLInputElement).value).toBe('')

      const withNull = await mountSuspended(InputBase, {
        props: { modelValue: null as unknown as string },
      })
      expect((withNull.find('input').element as HTMLInputElement).value).toBe('')
    })
  })

  describe('v-model', () => {
    it('updates modelValue when user types', async () => {
      const component = await mountSuspended(InputBase, {
        props: { modelValue: '' },
      })
      const input = component.find('input')
      await input.setValue('test')
      expect(component.emitted('update:modelValue')).toBeTruthy()
      expect(component.emitted('update:modelValue')?.at(-1)).toEqual(['test'])
    })

    it('reflects modelValue prop changes', async () => {
      const component = await mountSuspended(InputBase, {
        props: { modelValue: 'initial' },
      })
      await component.setProps({ modelValue: 'updated' })
      const input = component.find('input')
      expect((input.element as HTMLInputElement).value).toBe('updated')
    })
  })

  describe('noCorrect prop', () => {
    it('applies noCorrect attributes when noCorrect is true (default)', async () => {
      const component = await mountSuspended(InputBase)
      const input = component.find('input')
      expect(input.attributes('autocapitalize')).toBe('off')
      expect(input.attributes('autocomplete')).toBe('off')
      expect(input.attributes('autocorrect')).toBe('off')
      expect(input.attributes('spellcheck')).toBe('false')
    })

    it('does not apply noCorrect attributes when noCorrect is false', async () => {
      const component = await mountSuspended(InputBase, {
        props: { noCorrect: false },
      })
      const input = component.find('input')
      expect(input.attributes('autocapitalize')).toBeUndefined()
      expect(input.attributes('autocomplete')).toBeUndefined()
      expect(input.attributes('autocorrect')).toBeUndefined()
      expect(input.attributes('spellcheck')).toBeUndefined()
    })
  })

  describe('focus and blur', () => {
    it('emits focus when input is focused', async () => {
      const component = await mountSuspended(InputBase)
      const input = component.find('input')
      await input.trigger('focus')
      expect(component.emitted('focus')).toHaveLength(1)
    })

    it('emits blur when input loses focus', async () => {
      const component = await mountSuspended(InputBase)
      const input = component.find('input')
      await input.trigger('focus')
      await input.trigger('blur')
      expect(component.emitted('blur')).toHaveLength(1)
    })
  })

  describe('exposed API', () => {
    it('exposes focus() that focuses the input', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const component = await mountSuspended(InputBase, { attachTo: container })
      const input = component.find('input')
      expect(container.contains(document.activeElement)).toBe(false)
      component.vm.focus()
      await component.vm.$nextTick()
      expect(container.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).toBe(input.element)
      container.remove()
    })

    it('exposes blur() that blurs the input', async () => {
      const container = document.createElement('div')
      document.body.appendChild(container)
      const component = await mountSuspended(InputBase, { attachTo: container })
      const input = component.find('input')
      input.element.focus()
      expect(container.contains(document.activeElement)).toBe(true)
      expect(document.activeElement).toBe(input.element)
      component.vm.blur()
      await component.vm.$nextTick()
      expect(container.contains(document.activeElement)).toBe(false)
      expect(document.activeElement).not.toBe(input.element)
      container.remove()
    })

    it('exposes getBoundingClientRect()', async () => {
      const component = await mountSuspended(InputBase)
      const rect = component.vm.getBoundingClientRect()
      expect(rect).toBeDefined()
      expect(typeof rect?.width).toBe('number')
      expect(typeof rect?.height).toBe('number')
    })
  })

  describe('accessibility (attrs fallthrough)', () => {
    it('accepts placeholder via attrs', async () => {
      const component = await mountSuspended(InputBase, {
        attrs: { 'placeholder': 'Search packages...', 'aria-label': 'Search input' },
      })
      const input = component.find('input')
      expect(input.attributes('placeholder')).toBe('Search packages...')
      expect(input.attributes('aria-label')).toBe('Search input')
    })

    it('accepts disabled via attrs', async () => {
      const component = await mountSuspended(InputBase, {
        attrs: { disabled: '' },
      })
      const input = component.find('input')
      expect(input.attributes('disabled')).toBeDefined()
      expect((input.element as HTMLInputElement).disabled).toBe(true)
      // should add just `disabled`, not `disabled="true"`
      expect((input.element as HTMLInputElement).getHTML()).not.toContain('disabled=')
    })
  })
})
