import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import { TabRoot, TabList, TabItem, TabPanel } from '#components'

function createTabsWrapper(props: { modelValue: string; idPrefix?: string }) {
  return defineComponent({
    components: { TabRoot, TabList, TabItem, TabPanel },
    setup() {
      return () =>
        h(
          TabRoot,
          ({
	modelValue: props.modelValue,
	idPrefix: props.idPrefix ?? 'test',
	'onUpdate:modelValue': () => {}
}),
          () => [
            h(TabList, { ariaLabel: 'Test tabs' }, () => [
              h(TabItem, { value: 'one' }, () => 'One'),
              h(TabItem, { value: 'two' }, () => 'Two'),
              h(TabItem, { value: 'three' }, () => 'Three'),
            ]),
            h(TabPanel, { value: 'one' }, () => 'Content one'),
            h(TabPanel, { value: 'two' }, () => 'Content two'),
            h(TabPanel, { value: 'three' }, () => 'Content three'),
          ],
        )
    },
  })
}

async function mountTabs({ modelValue = 'one', idPrefix = 'test' } = {}) {
  const Wrapper = createTabsWrapper({ modelValue, idPrefix })
  return mountSuspended(Wrapper, { attachTo: document.body })
}

describe('Tab components', () => {
  describe('TabRoot', () => {
    it('renders tablist', async () => {
      const wrapper = await mountTabs()
      expect(wrapper.find('[role="tablist"]').exists()).toBe(true)
      wrapper.unmount()
    })

    it('provides selected value to children', async () => {
      const wrapper = await mountTabs({ modelValue: 'two' })
      const tabs = wrapper.findAll('[role="tab"]')
      const selected = tabs.find(t => t.attributes('aria-selected') === 'true')
      expect(selected?.text()).toBe('Two')
      wrapper.unmount()
    })
  })

  describe('TabList', () => {
    it('has tablist role and aria-label', async () => {
      const wrapper = await mountTabs()
      const tablist = wrapper.find('[role="tablist"]')
      expect(tablist.exists()).toBe(true)
      expect(tablist.attributes('aria-label')).toBe('Test tabs')
      wrapper.unmount()
    })

    it('supports arrow key navigation', async () => {
      const wrapper = await mountTabs()
      const tablist = wrapper.find('[role="tablist"]')
      const tabs = wrapper.findAll('[role="tab"]')

      ;(tabs[0]!.element as HTMLElement).focus()
      expect(document.activeElement).toBe(tabs[0]!.element)

      await tablist.trigger('keydown', { key: 'ArrowRight' })
      expect(document.activeElement).toBe(tabs[1]!.element)

      // Wraps around
      await tablist.trigger('keydown', { key: 'ArrowRight' })
      await tablist.trigger('keydown', { key: 'ArrowRight' })
      expect(document.activeElement).toBe(tabs[0]!.element)

      // ArrowLeft wraps backwards
      await tablist.trigger('keydown', { key: 'ArrowLeft' })
      expect(document.activeElement).toBe(tabs[2]!.element)

      wrapper.unmount()
    })

    it('supports Home and End keys', async () => {
      const wrapper = await mountTabs()
      const tablist = wrapper.find('[role="tablist"]')
      const tabs = wrapper.findAll('[role="tab"]')

      ;(tabs[1]!.element as HTMLElement).focus()

      await tablist.trigger('keydown', { key: 'Home' })
      expect(document.activeElement).toBe(tabs[0]!.element)

      await tablist.trigger('keydown', { key: 'End' })
      expect(document.activeElement).toBe(tabs[2]!.element)

      wrapper.unmount()
    })
  })

  describe('TabItem', () => {
    it('has correct ARIA attributes when selected', async () => {
      const wrapper = await mountTabs({ modelValue: 'one' })
      const tabs = wrapper.findAll('[role="tab"]')
      const first = tabs[0]!
      const second = tabs[1]!

      expect(first.attributes('aria-selected')).toBe('true')
      expect(first.attributes('tabindex')).toBe('-1')
      expect(first.attributes('data-selected')).toBeDefined()

      expect(second.attributes('aria-selected')).toBe('false')
      expect(second.attributes('tabindex')).toBe('0')
      expect(second.attributes('data-selected')).toBeUndefined()

      wrapper.unmount()
    })

    it('emits update:modelValue on click', async () => {
      const wrapper = await mountTabs({ modelValue: 'one' })
      const tabs = wrapper.findAll('[role="tab"]')

      await tabs[1]!.trigger('click')
      const root = wrapper.findComponent(TabRoot)
      expect(root.emitted('update:modelValue')?.[0]).toEqual(['two'])

      wrapper.unmount()
    })

    it('generates aria-controls pointing to panel id', async () => {
      const wrapper = await mountTabs({ idPrefix: 'my-tabs' })
      const tab = wrapper.findAll('[role="tab"]')[0]!
      expect(tab.attributes('aria-controls')).toBe('my-tabs-panel-one')
      wrapper.unmount()
    })
  })

  describe('TabPanel', () => {
    it('shows panel matching selected value', async () => {
      const wrapper = await mountTabs({ modelValue: 'one' })
      const panels = wrapper.findAll('[role="tabpanel"]')

      const visible = panels.filter(p => (p.element as HTMLElement).style.display !== 'none')
      expect(visible).toHaveLength(1)
      expect(visible[0]!.text()).toBe('Content one')

      wrapper.unmount()
    })

    it('hides panels not matching selected value', async () => {
      const wrapper = await mountTabs({ modelValue: 'two' })
      const panels = wrapper.findAll('[role="tabpanel"]')

      const visible = panels.filter(p => (p.element as HTMLElement).style.display !== 'none')
      expect(visible).toHaveLength(1)
      expect(visible[0]!.text()).toBe('Content two')

      wrapper.unmount()
    })

    it('has aria-labelledby pointing to tab id', async () => {
      const wrapper = await mountTabs({ idPrefix: 'demo' })
      const panel = wrapper.findAll('[role="tabpanel"]')[0]!
      expect(panel.attributes('aria-labelledby')).toBe('demo-one')
      wrapper.unmount()
    })
  })
})
