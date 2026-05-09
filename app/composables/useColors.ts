import { computed, type ComputedRef, type Ref, type ShallowRef, unref } from 'vue'
import { useMutationObserver, useResizeObserver, useSupported } from '@vueuse/core'

type CssVariableSource = HTMLElement | null | undefined | Ref<HTMLElement | null | undefined>

// Add existing css variables to expose in component scripts
const colorVariables = [
  '--accent',
  '--bg',
  '--bg-elevated',
  '--bg-subtle',
  '--border',
  '--border-hover',
  '--border-subtle',
  '--fg',
  '--fg-muted',
  '--fg-subtle',
] as const

function readCssVariable(element: HTMLElement, variableName: string): string {
  return getComputedStyle(element).getPropertyValue(variableName).trim()
}

function toCamelCase(cssVariable: string): string {
  return cssVariable.replace(/^--/, '').replace(/-([a-z0-9])/gi, (_, c) => c.toUpperCase())
}

function resolveElement(element: CssVariableSource): HTMLElement | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null
  const resolved = unref(element)
  return resolved ?? document.documentElement
}

export function useColors(
  element: ShallowRef<HTMLElement | null, HTMLElement | null>,
  options: { watchHtmlAttributes?: boolean; watchResize?: boolean } = {},
): { colors: ComputedRef<Record<string, string>> } {
  const isClientSupported = useSupported(
    () => typeof window !== 'undefined' && typeof document !== 'undefined',
  )

  const colors = computed<Record<string, string>>(() => {
    const resolvedElement = resolveElement(element)
    if (!resolvedElement) return {}
    const result: Record<string, string> = {}
    for (const variable of colorVariables) {
      result[toCamelCase(variable)] = readCssVariable(resolvedElement, variable)
    }
    return result
  })

  if (options.watchResize) {
    useResizeObserver(element, () => void colors.value)
  }

  if (options.watchHtmlAttributes && isClientSupported.value) {
    useMutationObserver(document.documentElement, () => void colors.value, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-bg-theme'],
    })
  }

  return { colors }
}
