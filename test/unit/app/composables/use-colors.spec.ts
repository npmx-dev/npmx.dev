import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, shallowRef } from 'vue'
import { useColors } from '~/composables/useColors'

const useSupportedMock = vi.hoisted(() => vi.fn())
const useMutationObserverMock = vi.hoisted(() => vi.fn())
const useResizeObserverMock = vi.hoisted(() => vi.fn())

vi.mock('@vueuse/core', () => {
  return {
    useSupported: (callback: () => boolean) => {
      useSupportedMock(callback)
      return computed(() => callback())
    },
    useMutationObserver: useMutationObserverMock,
    useResizeObserver: useResizeObserverMock,
  }
})

describe('useColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
