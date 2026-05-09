// @vitest-environment happy-dom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { computed, defineComponent, nextTick, shallowRef } from 'vue'
import { mount } from '@vue/test-utils'
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

function mockComputedStyle(values: Record<string, string>) {
  vi.stubGlobal('getComputedStyle', (element: HTMLElement) => ({
    getPropertyValue: (name: string) => values[`${element.id}:${name}`] ?? values[name] ?? '',
  }))
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

describe('useColors', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSupportedMock.mockReturnValue(computed(() => true))
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (typeof document !== 'undefined') {
      document.body.innerHTML = ''
      document.documentElement.removeAttribute('id')
    }
  })

  it('reads the configured color variables from the provided element', () => {
    const element = document.createElement('div')
    element.id = 'chart'
    document.body.appendChild(element)

    mockComputedStyle({
      '--accent': '#42b883',
      '--bg': '#ffffff',
      '--bg-elevated': '#f8f8f8',
      '--bg-subtle': '#f2f2f2',
      '--border': '#d9d9d9',
      '--border-hover': '#bdbdbd',
      '--border-subtle': '#eeeeee',
      '--fg': '#1a1a1a',
      '--fg-muted': '#666666',
      '--fg-subtle': '#999999',
    })

    const wrapper = mountWithSetup(() => {
      const elementReference = shallowRef<HTMLElement | null>(element)
      const { colors } = useColors(elementReference)

      expect(colors.value).toEqual({
        accent: '#42b883',
        bg: '#ffffff',
        bgElevated: '#f8f8f8',
        bgSubtle: '#f2f2f2',
        border: '#d9d9d9',
        borderHover: '#bdbdbd',
        borderSubtle: '#eeeeee',
        fg: '#1a1a1a',
        fgMuted: '#666666',
        fgSubtle: '#999999',
      })
    })

    wrapper.unmount()
  })

  it('falls back to the document element when the provided ref value is null', () => {
    document.documentElement.id = 'root'

    mockComputedStyle({
      'root:--accent': '#42b883',
      'root:--bg': '#ffffff',
      'root:--bg-elevated': '#f8f8f8',
      'root:--bg-subtle': '#f2f2f2',
      'root:--border': '#d9d9d9',
      'root:--border-hover': '#bdbdbd',
      'root:--border-subtle': '#eeeeee',
      'root:--fg': '#1a1a1a',
      'root:--fg-muted': '#666666',
      'root:--fg-subtle': '#999999',
    })

    const wrapper = mountWithSetup(() => {
      const elementReference = shallowRef<HTMLElement | null>(null)
      const { colors } = useColors(elementReference)
      expect(colors.value).toEqual({
        accent: '#42b883',
        bg: '#ffffff',
        bgElevated: '#f8f8f8',
        bgSubtle: '#f2f2f2',
        border: '#d9d9d9',
        borderHover: '#bdbdbd',
        borderSubtle: '#eeeeee',
        fg: '#1a1a1a',
        fgMuted: '#666666',
        fgSubtle: '#999999',
      })
    })
    wrapper.unmount()
  })

  it('reacts when the provided element ref changes', async () => {
    const firstElement = document.createElement('div')
    firstElement.id = 'first'
    const secondElement = document.createElement('div')
    secondElement.id = 'second'
    mockComputedStyle({
      'first:--accent': '#111111',
      'second:--accent': '#222222',
    })
    let colorsValue: ReturnType<typeof useColors>['colors']
    const elementReference = shallowRef<HTMLElement | null>(firstElement)
    const wrapper = mountWithSetup(() => {
      const { colors } = useColors(elementReference)
      colorsValue = colors
    })
    expect(colorsValue!.value.accent).toBe('#111111')
    elementReference.value = secondElement
    await nextTick()
    expect(colorsValue!.value.accent).toBe('#222222')
    wrapper.unmount()
  })

  it('attaches an html mutation observer when enabled and client is supported', async () => {
    const element = document.createElement('div')
    element.id = 'mutation'
    const elementReference = shallowRef<HTMLElement | null>(element)
    mockComputedStyle({
      'mutation:--accent': '#111111',
    })
    const wrapper = mountWithSetup(() => {
      const { colors } = useColors(elementReference, { watchHtmlAttributes: true })
      expect(colors.value.accent).toBe('#111111')
    })
    await nextTick()
    expect(useMutationObserverMock).toHaveBeenCalledTimes(1)
    mockComputedStyle({ 'mutation:--accent': '#222222' })
    const mutationCallback = useMutationObserverMock.mock.calls?.[0]?.[1]
    expect(() => mutationCallback()).not.toThrow()
    wrapper.unmount()
  })

  it('does not attach an html mutation observer when client is not supported', () => {
    const originalWindow = globalThis.window
    vi.stubGlobal('window', undefined)
    const elementReference = shallowRef<HTMLElement | null>(document.createElement('div'))
    mockComputedStyle({})
    useColors(elementReference, { watchHtmlAttributes: true })
    expect(useMutationObserverMock).not.toHaveBeenCalled()
    vi.stubGlobal('window', originalWindow)
  })

  it('attaches a resize observer when enabled', async () => {
    const element = document.createElement('div')
    element.id = 'resize'
    const elementReference = shallowRef<HTMLElement | null>(element)
    mockComputedStyle({ 'resize:--accent': '#111111' })
    const wrapper = mountWithSetup(() => {
      const { colors } = useColors(elementReference, { watchResize: true })
      expect(colors.value.accent).toBe('#111111')
    })
    await nextTick()
    expect(useResizeObserverMock).toHaveBeenCalledTimes(1)
    expect(useResizeObserverMock).toHaveBeenCalledWith(expect.any(Object), expect.any(Function))
    mockComputedStyle({ 'resize:--accent': '#222222' })
    const resizeCallback = useResizeObserverMock.mock.calls?.[0]?.[1]
    expect(() => resizeCallback()).not.toThrow()
    wrapper.unmount()
  })

  it('does not attach observers by default', async () => {
    const elementReference = shallowRef<HTMLElement | null>(document.createElement('div'))
    mockComputedStyle({})
    const wrapper = mountWithSetup(() => {
      useColors(elementReference)
    })
    await nextTick()
    expect(useMutationObserverMock).not.toHaveBeenCalled()
    expect(useResizeObserverMock).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('returns an empty color object when window or document is unavailable', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const elementReference = shallowRef<HTMLElement | null>(null)
    const { colors } = useColors(elementReference)
    expect(colors.value).toEqual({})
  })
})
