import { describe, expect, it } from 'vitest'
import { computed, ref } from 'vue'
import { useVisibleItems } from '~/composables/useVisibleItems'

describe('useVisibleItems', () => {
  describe('initial state', () => {
    it('returns all items when list is within limit', () => {
      const { visibleItems, hasMore, hiddenCount } = useVisibleItems(['a', 'b', 'c'], 5)

      expect(visibleItems.value).toEqual(['a', 'b', 'c'])
      expect(hasMore.value).toBe(false)
      expect(hiddenCount.value).toBe(0)
    })

    it('returns exactly limit items when list exceeds limit', () => {
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const { visibleItems, hasMore, hiddenCount } = useVisibleItems(items, 5)

      expect(visibleItems.value).toEqual([1, 2, 3, 4, 5])
      expect(hasMore.value).toBe(true)
      expect(hiddenCount.value).toBe(5)
    })

    it('returns all items when list length equals limit exactly', () => {
      const items = [1, 2, 3]
      const { visibleItems, hasMore, hiddenCount } = useVisibleItems(items, 3)

      expect(visibleItems.value).toEqual([1, 2, 3])
      expect(hasMore.value).toBe(false)
      expect(hiddenCount.value).toBe(0)
    })

    it('handles empty list', () => {
      const { visibleItems, hasMore, hiddenCount } = useVisibleItems([], 5)

      expect(visibleItems.value).toEqual([])
      expect(hasMore.value).toBe(false)
      expect(hiddenCount.value).toBe(0)
    })
  })

  describe('expand()', () => {
    it('shows all items after expand', () => {
      const items = [1, 2, 3, 4, 5, 6]
      const { visibleItems, hasMore, hiddenCount, expand } = useVisibleItems(items, 3)

      expect(visibleItems.value).toEqual([1, 2, 3])

      expand()

      expect(visibleItems.value).toEqual([1, 2, 3, 4, 5, 6])
      expect(hasMore.value).toBe(false)
      expect(hiddenCount.value).toBe(0)
    })
  })

  describe('collapse()', () => {
    it('hides items again after collapse', () => {
      const items = [1, 2, 3, 4, 5, 6]
      const { visibleItems, hasMore, expand, collapse } = useVisibleItems(items, 3)

      expect(visibleItems.value).toEqual([1, 2, 3])

      expand()

      expect(visibleItems.value).toEqual([1, 2, 3, 4, 5, 6])

      collapse()

      expect(visibleItems.value).toEqual([1, 2, 3])
      expect(hasMore.value).toBe(true)
    })
  })

  describe('toggle()', () => {
    it('expands on first toggle', () => {
      const items = [1, 2, 3, 4, 5]
      const { visibleItems, toggle } = useVisibleItems(items, 3)

      expect(visibleItems.value).toEqual([1, 2, 3])

      toggle()

      expect(visibleItems.value).toEqual([1, 2, 3, 4, 5])
    })

    it('collapses on second toggle', () => {
      const items = [1, 2, 3, 4, 5]
      const { visibleItems, toggle } = useVisibleItems(items, 3)

      expect(visibleItems.value).toEqual([1, 2, 3])

      toggle()

      expect(visibleItems.value).toEqual([1, 2, 3, 4, 5])

      toggle()

      expect(visibleItems.value).toEqual([1, 2, 3])
    })
  })

  describe('reactivity', () => {
    it('reacts to ref source changes', () => {
      const items = ref([1, 2, 3])
      const { visibleItems, hasMore, hiddenCount } = useVisibleItems(items, 2)

      expect(visibleItems.value).toEqual([1, 2])
      expect(hasMore.value).toBe(true)
      expect(hiddenCount.value).toBe(1)

      items.value = [1, 2]

      expect(visibleItems.value).toEqual([1, 2])
      expect(hasMore.value).toBe(false)
      expect(hiddenCount.value).toBe(0)
    })

    it('reacts to computed source changes', () => {
      const source = ref([1, 2, 3, 4, 5])
      const filtered = computed(() => source.value.filter(n => n % 2 === 0))
      const { visibleItems, hasMore } = useVisibleItems(filtered, 3)

      expect(visibleItems.value).toEqual([2, 4])
      expect(hasMore.value).toBe(false)

      source.value = [1, 2, 3, 4, 5, 6, 7, 8]

      expect(visibleItems.value).toEqual([2, 4, 6])
      expect(hasMore.value).toBe(true)
    })

    it('reacts to getter function source changes', () => {
      const count = ref(2)
      const { visibleItems } = useVisibleItems(
        () => Array.from({ length: count.value }, (_, i) => i),
        3,
      )

      expect(visibleItems.value).toEqual([0, 1])

      count.value = 5

      expect(visibleItems.value).toEqual([0, 1, 2])
    })
  })
})
