import type { computed } from 'vue'
import { ref, shallowRef } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useChartTooltipPosition } from '~/composables/useChartTooltipPosition'

const mouseState = vi.hoisted(() => ({
  target: null as unknown,
}))

const elementX = ref(0)
const elementWidth = ref(0)
const isOutside = ref(true)

const MockHTMLElement = class {
  public readonly nodeType = 1
}

vi.stubGlobal('HTMLElement', MockHTMLElement)

afterEach(() => {
  vi.unstubAllGlobals()
})

vi.mock('@vueuse/core', () => ({
  useMouseInElement: vi.fn(target => {
    mouseState.target = target

    return {
      elementX,
      elementWidth,
      isOutside,
    }
  }),
}))

describe('useChartTooltipPosition', () => {
  beforeEach(() => {
    vi.stubGlobal('HTMLElement', MockHTMLElement)
    elementX.value = 0
    elementWidth.value = 0
    isOutside.value = true
    mouseState.target = null
  })

  it('returns center when the mouse is outside', () => {
    const element = new MockHTMLElement() as HTMLElement
    const position = useChartTooltipPosition(shallowRef(element))

    isOutside.value = true
    elementWidth.value = 100
    elementX.value = 75

    expect(position.value).toBe('center')
  })

  it('returns center when element width is 0', () => {
    const element = new MockHTMLElement() as HTMLElement
    const position = useChartTooltipPosition(shallowRef(element))
    isOutside.value = false
    elementWidth.value = 0
    elementX.value = 75
    expect(position.value).toBe('center')
  })

  it('returns left when the mouse is on the right half of the element', () => {
    const element = new MockHTMLElement() as HTMLElement
    const position = useChartTooltipPosition(shallowRef(element))
    isOutside.value = false
    elementWidth.value = 100
    elementX.value = 51
    expect(position.value).toBe('left')
  })

  it('returns right when the mouse is on the left half of the element', () => {
    const element = new MockHTMLElement() as HTMLElement
    const position = useChartTooltipPosition(shallowRef(element))
    isOutside.value = false
    elementWidth.value = 100
    elementX.value = 49
    expect(position.value).toBe('right')
  })

  it('returns right when the mouse is exactly at the center', () => {
    const element = new MockHTMLElement() as HTMLElement
    const position = useChartTooltipPosition(shallowRef(element))
    isOutside.value = false
    elementWidth.value = 100
    elementX.value = 50
    expect(position.value).toBe('right')
  })

  it('accepts a Vue component ref exposing $el', () => {
    const element = new MockHTMLElement() as HTMLElement
    const componentReference = shallowRef({ $el: element })
    useChartTooltipPosition(componentReference)
    expect((mouseState.target as ReturnType<typeof computed>).value).toBe(element)
  })

  it('returns null as target when ref value is null', () => {
    useChartTooltipPosition(shallowRef(null))
    expect((mouseState.target as ReturnType<typeof computed>).value).toBe(null)
  })

  it('returns null when component ref has no $el', () => {
    const componentReference = shallowRef({})
    useChartTooltipPosition(componentReference)
    expect((mouseState.target as ReturnType<typeof computed>).value).toBe(null)
  })

  it('uses the HTMLElement directly as target', () => {
    const element = new MockHTMLElement() as HTMLElement
    useChartTooltipPosition(shallowRef(element))
    expect((mouseState.target as ReturnType<typeof computed>).value).toBe(element)
  })

  it('uses the component $el as target', () => {
    const element = new MockHTMLElement() as HTMLElement
    const componentReference = shallowRef({ $el: element })
    useChartTooltipPosition(componentReference)
    expect((mouseState.target as ReturnType<typeof computed>).value).toBe(element)
  })
})
