/**
 * This composable returns a dynamic position to be fed to vue-data-ui components configugration for the `tooltip.position` attribute. Use it to position tooltips to the right or left side to free the view for datapoints, typically on line charts.
 */
import { computed, toValue } from 'vue'
import { useMouseInElement } from '@vueuse/core'

type TooltipPosition = 'left' | 'right' | 'center'
type TemplateRefValue = HTMLElement | { $el?: HTMLElement } | null | undefined

export function useChartTooltipPosition(
  chartRef: MaybeRefOrGetter<TemplateRefValue>,
): ComputedRef<TooltipPosition> {
  const target = computed<HTMLElement | null>(() => {
    const value = toValue(chartRef)
    if (!value) return null
    if (value instanceof HTMLElement) return value
    return value.$el || null
  })

  const { elementX, elementWidth, isOutside } = useMouseInElement(target)

  return computed<TooltipPosition>(() => {
    if (isOutside.value || elementWidth.value === 0) return 'center'
    return elementX.value > elementWidth.value / 2 ? 'left' : 'right'
  })
}
