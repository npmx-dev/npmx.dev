import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { RecentItem } from '../../../../app/composables/useRecentlyViewed'

// Mock @vueuse/core to use a plain ref instead of localStorage
const storageRef = ref<RecentItem[]>([])
vi.mock('@vueuse/core', () => ({
  useLocalStorage: () => storageRef,
}))

// Must import after mock is set up
const { useRecentlyViewed } = await import('../../../../app/composables/useRecentlyViewed')

describe('useRecentlyViewed', () => {
  beforeEach(() => {
    storageRef.value = []
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an empty list initially', () => {
    const { items } = useRecentlyViewed()
    expect(items.value).toEqual([])
  })

  it('adds an item to an empty list', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })
    expect(items.value).toHaveLength(1)
    expect(items.value[0]).toMatchObject({ type: 'package', name: 'vue', label: 'vue' })
    expect(items.value[0]!.viewedAt).toBeTypeOf('number')
  })

  it('deduplicates by type and name, bumping to front', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })
    trackRecentView({ type: 'package', name: 'react', label: 'react' })
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })

    expect(items.value).toHaveLength(2)
    expect(items.value[0]!.name).toBe('vue')
    expect(items.value[1]!.name).toBe('react')
  })

  it('caps at 5 items, evicting the oldest', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    for (let i = 1; i <= 6; i++) {
      trackRecentView({ type: 'package', name: `pkg-${i}`, label: `pkg-${i}` })
    }

    expect(items.value).toHaveLength(5)
    expect(items.value[0]!.name).toBe('pkg-6')
    expect(items.value[4]!.name).toBe('pkg-2')
    // pkg-1 should have been evicted
    expect(items.value.find(i => i.name === 'pkg-1')).toBeUndefined()
  })

  it('allows different entity types to coexist', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })
    trackRecentView({ type: 'org', name: 'nuxt', label: '@nuxt' })
    trackRecentView({ type: 'user', name: 'sindresorhus', label: '~sindresorhus' })

    expect(items.value).toHaveLength(3)
    expect(items.value.map(i => i.type)).toEqual(['user', 'org', 'package'])
  })

  it('does not deduplicate items with the same name but different type', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    trackRecentView({ type: 'package', name: 'nuxt', label: 'nuxt' })
    trackRecentView({ type: 'org', name: 'nuxt', label: '@nuxt' })

    expect(items.value).toHaveLength(2)
  })

  it('sets viewedAt on new entries', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    const before = Date.now()
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })
    const after = Date.now()

    expect(items.value[0]!.viewedAt).toBeGreaterThanOrEqual(before)
    expect(items.value[0]!.viewedAt).toBeLessThanOrEqual(after)
  })

  it('updates viewedAt when deduplicating', () => {
    const { trackRecentView, items } = useRecentlyViewed()
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })
    const firstViewedAt = items.value[0]!.viewedAt

    // Small delay to ensure timestamp differs
    vi.spyOn(Date, 'now').mockReturnValueOnce(firstViewedAt + 1000)
    trackRecentView({ type: 'package', name: 'vue', label: 'vue' })

    expect(items.value[0]!.viewedAt).toBeGreaterThan(firstViewedAt)
  })
})
