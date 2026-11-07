import { useRouteQuery } from '@vueuse/router'

/**
 * "Frozen history" toggle for the package timeline's size metrics, saved in
 * the query string (`?frozen-history=false`).
 *
 * - When `true` (default for the timeline view), the versions of the dependencies
 *   of each version are limited to those that were available before the next version
 *   of this package was published.
 * - When `false`, the dependencies of each version are resolved to the latest
 *   versions that satisfies their ranges, as if it was installed today.
 */
export function useTimelineFrozenHistory(): WritableComputedRef<boolean> {
  const frozenParam = useRouteQuery<string | undefined>('frozen-history', undefined)

  return computed<boolean>({
    get() {
      return frozenParam.value !== 'false'
    },
    set(value) {
      frozenParam.value = value ? undefined : 'false'
    },
  })
}
