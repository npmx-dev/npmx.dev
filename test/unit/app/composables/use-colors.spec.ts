import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, nextTick, shallowRef, ref, type Ref } from 'vue'
import { useColors } from '~/composables/useColors'

const useSupportedMock = vi.hoisted(() => vi.fn())
const useMutationObserverMock = vi.hoisted(() => vi.fn())
const useResizeObserverMock = vi.hoisted(() => vi.fn())

const vueUseMockState = vi.hoisted(() => ({
  preferredDark: undefined as unknown as Ref<boolean>,
}))

vi.mock('@vueuse/core', () => {
  vueUseMockState.preferredDark = ref(false)

  return {
    useSupported: (callback: () => boolean) => {
      useSupportedMock(callback)
      return computed(() => callback())
    },
    useMutationObserver: useMutationObserverMock,
    useResizeObserver: useResizeObserverMock,
    usePreferredDark: () => vueUseMockState.preferredDark,
  }
})

describe('useColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vueUseMockState.preferredDark.value = false
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not attach an html mutation observer when client is not supported', () => {
    vi.stubGlobal('window', undefined)
    const elementReference = shallowRef<HTMLElement | null>(null)
    useColors(elementReference, { watchHtmlAttributes: true })
    expect(useMutationObserverMock).not.toHaveBeenCalled()
  })

  it('attaches a resize observer when enabled', () => {
    const elementReference = shallowRef<HTMLElement | null>(null)
    useColors(elementReference, { watchResize: true })
    expect(useResizeObserverMock).toHaveBeenCalledTimes(1)
    expect(useResizeObserverMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Function))
    const resizeCallback = useResizeObserverMock.mock.calls?.[0]?.[1]
    expect(resizeCallback).toBeDefined()
    expect(() => resizeCallback()).not.toThrow()
  })

  it('does not attach observers by default', () => {
    const elementReference = shallowRef<HTMLElement | null>(null)
    useColors(elementReference)
    expect(useMutationObserverMock).not.toHaveBeenCalled()
    expect(useResizeObserverMock).not.toHaveBeenCalled()
  })

  it('returns an empty color object when window or document is unavailable', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const elementReference = shallowRef<HTMLElement | null>(null)
    const { colors } = useColors(elementReference)
    expect(colors.value).toEqual({})
  })

  it('recomputes colors when preferred dark mode changes', async () => {
    const styleValues = {
      accent: '#FF0000',
    }

    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {
      documentElement: {},
    })

    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (variableName: string) => {
        if (variableName === '--accent') {
          return styleValues.accent
        }

        return ''
      },
    }))

    const elementReference = shallowRef<HTMLElement | null>({} as HTMLElement)
    const { colors } = useColors(elementReference)
    expect(colors.value.accent).toBe('#FF0000')
    styleValues.accent = '#00FF00'
    vueUseMockState.preferredDark.value = true
    await nextTick()

    expect(colors.value.accent).toBe('#00FF00')
  })

  it('attaches an html mutation observer when enabled', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {
      documentElement: {},
    })
    const elementReference = shallowRef<HTMLElement | null>(null)
    useColors(elementReference, {
      watchHtmlAttributes: true,
    })
    expect(useMutationObserverMock).toHaveBeenCalledTimes(1)
    expect(useMutationObserverMock).toHaveBeenCalledWith(
      document.documentElement,
      expect.any(Function),
      {
        attributes: true,
        attributeFilter: ['class', 'style', 'data-theme', 'data-bg-theme'],
      },
    )
  })

  it('falls back to document element when no element is provided', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('document', {
      documentElement: {},
    })
    vi.stubGlobal('getComputedStyle', (element: HTMLElement) => {
      expect(element).toBe(document.documentElement)

      return {
        getPropertyValue: (variableName: string) => {
          if (variableName === '--accent') {
            return 'red'
          }

          return ''
        },
      }
    })
    const elementReference = shallowRef<HTMLElement | null>(null)
    const { colors } = useColors(elementReference)
    expect(colors.value.accent).toBe('red')
  })
})
