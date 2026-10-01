import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TooltipBase from '~/components/Tooltip/Base.vue'
import TooltipApp from '~/components/Tooltip/App.vue'

describe('TooltipBase to prop', () => {
  it('teleports to body by default', async () => {
    await mountSuspended(TooltipBase, {
      props: {
        text: 'Tooltip text',
        isVisible: true,
        tooltipAttr: { 'aria-label': 'tooltip' },
      },
      slots: {
        default: '<button>Trigger</button>',
      },
    })

    const tooltip = document.querySelector<HTMLElement>('[aria-label="tooltip"]')
    expect(tooltip).not.toBeNull()
    expect(tooltip?.textContent).toContain('Tooltip text')

    const currentContainer = tooltip?.parentElement?.parentElement
    expect(currentContainer).toBe(document.body)
  })

  it('teleports into provided container when using selector string', async () => {
    const container = document.createElement('div')
    container.id = 'tooltip-container'
    document.body.appendChild(container)

    try {
      await mountSuspended(TooltipBase, {
        props: {
          text: 'Tooltip text',
          isVisible: true,
          to: '#tooltip-container',
          tooltipAttr: { 'aria-label': 'tooltip' },
        },
        slots: {
          default: '<button>Trigger</button>',
        },
      })

      const tooltip = container.querySelector<HTMLElement>('[aria-label="tooltip"]')
      expect(tooltip).not.toBeNull()
      expect(tooltip?.textContent).toContain('Tooltip text')

      const currentContainer = tooltip?.parentElement?.parentElement
      expect(currentContainer).toBe(container)
    } finally {
      container.remove()
    }
  })
})

describe('TooltipApp hides when the page loses focus', () => {
  const label = 'app-tooltip'
  const findTooltip = () => document.querySelector(`[aria-label="${label}"]`)

  async function mountVisibleTooltip() {
    const wrapper = await mountSuspended(TooltipApp, {
      props: {
        text: 'Tooltip text',
        tooltipAttr: { 'aria-label': label },
      },
      slots: {
        default: '<a href="https://example.com" target="_blank">Trigger</a>',
      },
    })

    await wrapper.find('div').trigger('mouseenter')
    // one tick renders the tooltip, the next registers the window listeners
    await nextTick()
    await nextTick()
    expect(findTooltip()).not.toBeNull()

    return wrapper
  }

  it('hides when the window is blurred (link opened in a new tab)', async () => {
    const wrapper = await mountVisibleTooltip()
    try {
      window.dispatchEvent(new Event('blur'))
      await nextTick()

      expect(findTooltip()).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })

  it('hides when the document becomes hidden', async () => {
    const wrapper = await mountVisibleTooltip()
    // `hidden` normally lives on the prototype, so there is no own descriptor to
    // put back - deleting the override is what restores the initial state
    const ownHidden = Object.getOwnPropertyDescriptor(document, 'hidden')
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    try {
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()

      expect(findTooltip()).toBeNull()
    } finally {
      if (ownHidden) Object.defineProperty(document, 'hidden', ownHidden)
      else Reflect.deleteProperty(document, 'hidden')
      wrapper.unmount()
    }
  })

  it('stays visible while the page keeps focus', async () => {
    const wrapper = await mountVisibleTooltip()
    try {
      document.dispatchEvent(new Event('visibilitychange'))
      await nextTick()

      expect(findTooltip()).not.toBeNull()
    } finally {
      wrapper.unmount()
    }
  })
})

describe('TooltipApp focus handling', () => {
  const label = 'focus-tooltip'
  const findTooltip = () => document.querySelector(`[aria-label="${label}"]`)

  async function mountTooltip() {
    return await mountSuspended(TooltipApp, {
      props: {
        text: 'Tooltip text',
        tooltipAttr: { 'aria-label': label },
      },
      slots: {
        default: '<a href="https://example.com" target="_blank">Trigger</a>',
      },
    })
  }

  it('shows when the trigger is focused by keyboard', async () => {
    const wrapper = await mountTooltip()
    const link = wrapper.find('a')
    const element = link.element
    // headless browsers cannot drive real keyboard focus, so mark the link the
    // way the browser marks a tabbed-to element
    const matches = element.matches.bind(element)
    element.matches = ((selectors: string) =>
      selectors === ':focus-visible' ? true : matches(selectors)) as Element['matches']

    try {
      await link.trigger('focusin')
      await nextTick()

      expect(findTooltip()).not.toBeNull()
    } finally {
      element.matches = matches
      wrapper.unmount()
    }
  })

  it('does not show when the trigger is focused by a pointer', async () => {
    const wrapper = await mountTooltip()
    try {
      const link = wrapper.find('a')
      await link.trigger('focusin')
      await nextTick()

      expect(findTooltip()).toBeNull()
    } finally {
      wrapper.unmount()
    }
  })
})
