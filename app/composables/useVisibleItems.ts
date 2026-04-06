import { computed, shallowRef, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

export function useVisibleItems<T>(items: MaybeRefOrGetter<T[]>, limit: number) {
  const showAll = shallowRef(false)

  const visibleItems = computed(() => {
    const list = toValue(items)
    return showAll.value ? list : list.slice(0, limit)
  })

  const hiddenCount = computed(() =>
    showAll.value ? 0 : Math.max(0, toValue(items).length - limit),
  )

  const hasMore = computed(() => !showAll.value && toValue(items).length > limit)

  const expand = () => {
    showAll.value = true
  }
  const collapse = () => {
    showAll.value = false
  }
  const toggle = () => {
    showAll.value = !showAll.value
  }

  return { visibleItems, hiddenCount, hasMore, showAll, expand, collapse, toggle }
}
