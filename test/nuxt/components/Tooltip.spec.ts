import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import TooltipBase from '~/components/Tooltip/Base.vue'

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
