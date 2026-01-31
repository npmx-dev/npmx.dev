import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computed, nextTick, defineComponent } from 'vue'
import { mount } from '@vue/test-utils'
import type * as VueUseCore from '@vueuse/core'

const useSupportedMock = vi.hoisted(() => vi.fn())
const useMutationObserverMock = vi.hoisted(() => vi.fn())
const useResizeObserverMock = vi.hoisted(() => vi.fn())

let lastMutationObserverInstance: {
  observe: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  takeRecords: ReturnType<typeof vi.fn>
} | null = null

const mutationObserverConstructorMock = vi.hoisted(() =>
  vi.fn(function MutationObserver() {
    lastMutationObserverInstance = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      takeRecords: vi.fn(),
    }
    return lastMutationObserverInstance
  }),
)

vi.mock('@vueuse/core', async () => {
  const actual = await vi.importActual<typeof VueUseCore>('@vueuse/core')
  return {
    ...actual,
    useSupported: useSupportedMock,
    useMutationObserver: useMutationObserverMock,
    useResizeObserver: useResizeObserverMock,
  }
})

function mockComputedStyle(values: Record<string, string>) {
  vi.stubGlobal('getComputedStyle', () => {
    return {
      getPropertyValue: (name: string) => values[name] ?? '',
    } as any
  })
}

function mountWithSetup(run: () => void) {
  return mount(
    defineComponent({
      name: 'TestHarness',
      setup() {
        run()
        return () => null
      },
    }),
    { attachTo: document.body },
  )
}

describe('useCssVariables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    lastMutationObserverInstance = null
    vi.stubGlobal('MutationObserver', mutationObserverConstructorMock as any)
  })

  it('does not attach html mutation observer when client is not supported', async () => {
    const { useCssVariables } = await import('../../../app/composables/useColors')

    useSupportedMock.mockReturnValueOnce(computed(() => false))
    mockComputedStyle({ '--bg': 'oklch(1 0 0)' })

    const wrapper = mountWithSetup(() => {
      const { colors } = useCssVariables(['--bg'], { watchHtmlAttributes: true })
      expect(colors.value.bg).toBe('oklch(1 0 0)')
    })

    await nextTick()

    expect(useMutationObserverMock).not.toHaveBeenCalled()
    expect(lastMutationObserverInstance).not.toBeNull()
    expect(lastMutationObserverInstance!.observe).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })

  it('attaches html mutation observer when client is supported', async () => {
    const { useCssVariables } = await import('../../../app/composables/useColors')

    useSupportedMock.mockReturnValueOnce(computed(() => true))
    mockComputedStyle({ '--bg': 'oklch(1 0 0)' })

    const wrapper = mountWithSetup(() => {
      useCssVariables(['--bg'], { watchHtmlAttributes: true })
    })

    await nextTick()

    expect(lastMutationObserverInstance).not.toBeNull()
    expect(lastMutationObserverInstance!.observe).toHaveBeenCalledTimes(1)

    wrapper.unmount()
  })
})
