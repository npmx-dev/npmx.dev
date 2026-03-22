import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ButtonBase from '~/components/Button/Base.vue'

describe('ButtonBase', () => {
  it('has cursor-pointer class on enabled button', async () => {
    const wrapper = await mountSuspended(ButtonBase)
    const button = wrapper.find('button')
    expect(button.classes()).toContain('cursor-pointer')
  })

  it('has cursor-not-allowed on disabled state via class', async () => {
    const wrapper = await mountSuspended(ButtonBase, {
      props: { disabled: true },
    })
    const button = wrapper.find('button')
    // The class string includes the disabled modifier with cursor-not-allowed
    expect(button.attributes('class')).toContain('cursor-not-allowed')
  })

  it('does not have disabled attribute when not disabled', async () => {
    const wrapper = await mountSuspended(ButtonBase)
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('has disabled attribute when disabled prop is true', async () => {
    const wrapper = await mountSuspended(ButtonBase, {
      props: { disabled: true },
    })
    const button = wrapper.find('button')
    expect(button.attributes('disabled')).toBeDefined()
  })
})
