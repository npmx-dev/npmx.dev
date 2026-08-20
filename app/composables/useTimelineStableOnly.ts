import { useRouteQuery } from '@vueuse/router'
import { parseStableVersion } from '~/utils/versions'

/**
 * "Stable only" filter for the package timeline, persisted in the query string
 * (`?stable=1` / `?stable=0`).
 *
 * The default is version-derived: off when the currently selected version is a
 * pre-release (so the version you navigated to stays visible), on otherwise.
 * The value equal to that default is omitted from the URL to keep links clean.
 *
 * Shared between the timeline page (list + sub-events) and the chart (toggle),
 * both of which read the same route query so they stay in sync.
 */
export function useTimelineStableOnly(): WritableComputedRef<boolean> {
  const route = useRoute('timeline')
  const stableParam = useRouteQuery<string | undefined>('stable', undefined)

  const selectedIsUnstable = computed(() => {
    const selected = route.params.version as string | undefined
    return !!selected && parseStableVersion(selected) === null
  })

  return computed<boolean>({
    get() {
      if (stableParam.value === '1') return true
      if (stableParam.value === '0') return false
      return !selectedIsUnstable.value
    },
    set(value) {
      const isDefault = value === !selectedIsUnstable.value
      stableParam.value = isDefault ? undefined : value ? '1' : '0'
    },
  })
}
