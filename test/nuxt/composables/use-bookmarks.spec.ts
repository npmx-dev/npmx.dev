import { beforeEach, describe, expect, it } from 'vitest'

describe('useBookmarks', () => {
  beforeEach(() => {
    localStorage.clear()
    const { clearBookmarks } = useBookmarks()
    clearBookmarks()
  })

  describe('initial state', () => {
    it('should start with empty bookmarks', () => {
      const { bookmarks, hasBookmarks, bookmarkCount } = useBookmarks()

      expect(bookmarks.value).toEqual([])
      expect(hasBookmarks.value).toBe(false)
      expect(bookmarkCount.value).toBe(0)
    })
  })

  describe('addBookmark', () => {
    it('should add a bookmark', () => {
      const { bookmarks, addBookmark, isBookmarked, hasBookmarks, bookmarkCount } = useBookmarks()

      addBookmark('vue')

      expect(isBookmarked('vue')).toBe(true)
      expect(hasBookmarks.value).toBe(true)
      expect(bookmarkCount.value).toBe(1)
      expect(bookmarks.value[0]!.packageName).toBe('vue')
    })

    it('should not add duplicate bookmarks', () => {
      const { bookmarks, addBookmark } = useBookmarks()

      addBookmark('vue')
      addBookmark('vue')

      expect(bookmarks.value).toHaveLength(1)
    })

    it('should prepend new bookmarks (most recent first)', () => {
      const { bookmarks, addBookmark } = useBookmarks()

      addBookmark('vue')
      addBookmark('react')
      addBookmark('angular')

      expect(bookmarks.value[0]!.packageName).toBe('angular')
      expect(bookmarks.value[1]!.packageName).toBe('react')
      expect(bookmarks.value[2]!.packageName).toBe('vue')
    })

    it('should handle scoped packages', () => {
      const { addBookmark, isBookmarked } = useBookmarks()

      addBookmark('@nuxt/kit')

      expect(isBookmarked('@nuxt/kit')).toBe(true)
    })

    it('should store addedAt timestamp', () => {
      const { bookmarks, addBookmark } = useBookmarks()
      const before = Date.now()

      addBookmark('vue')

      const after = Date.now()
      expect(bookmarks.value[0]!.addedAt).toBeGreaterThanOrEqual(before)
      expect(bookmarks.value[0]!.addedAt).toBeLessThanOrEqual(after)
    })
  })

  describe('removeBookmark', () => {
    it('should remove a bookmark', () => {
      const { addBookmark, removeBookmark, isBookmarked, bookmarkCount } = useBookmarks()

      addBookmark('vue')
      addBookmark('react')
      removeBookmark('vue')

      expect(isBookmarked('vue')).toBe(false)
      expect(isBookmarked('react')).toBe(true)
      expect(bookmarkCount.value).toBe(1)
    })

    it('should handle removing non-existent bookmark', () => {
      const { bookmarks, addBookmark, removeBookmark } = useBookmarks()

      addBookmark('vue')
      removeBookmark('react')

      expect(bookmarks.value).toHaveLength(1)
    })
  })

  describe('toggleBookmark', () => {
    it('should toggle bookmark status', () => {
      const { toggleBookmark, isBookmarked } = useBookmarks()

      expect(isBookmarked('vue')).toBe(false)
      toggleBookmark('vue')
      expect(isBookmarked('vue')).toBe(true)
      toggleBookmark('vue')
      expect(isBookmarked('vue')).toBe(false)
      toggleBookmark('vue')
      expect(isBookmarked('vue')).toBe(true)
    })
  })

  describe('clearBookmarks', () => {
    it('should remove all bookmarks', () => {
      const { addBookmark, clearBookmarks, hasBookmarks, bookmarkCount } = useBookmarks()

      addBookmark('vue')
      addBookmark('react')
      addBookmark('angular')

      expect(bookmarkCount.value).toBe(3)

      clearBookmarks()

      expect(hasBookmarks.value).toBe(false)
      expect(bookmarkCount.value).toBe(0)
    })

    it('should handle clearing empty bookmarks', () => {
      const { clearBookmarks, hasBookmarks } = useBookmarks()

      clearBookmarks()

      expect(hasBookmarks.value).toBe(false)
    })
  })

  describe('useIsBookmarked', () => {
    it('should return reactive computed', () => {
      const { useIsBookmarked, toggleBookmark } = useBookmarks()
      const isVueBookmarked = useIsBookmarked('vue')

      expect(isVueBookmarked.value).toBe(false)

      toggleBookmark('vue')
      expect(isVueBookmarked.value).toBe(true)

      toggleBookmark('vue')
      expect(isVueBookmarked.value).toBe(false)
    })

    it('should work with ref parameter', () => {
      const { useIsBookmarked, addBookmark } = useBookmarks()
      const packageName = ref('vue')
      const isBookmarked = useIsBookmarked(packageName)

      expect(isBookmarked.value).toBe(false)

      addBookmark('vue')
      expect(isBookmarked.value).toBe(true)

      packageName.value = 'react'
      expect(isBookmarked.value).toBe(false)

      addBookmark('react')
      expect(isBookmarked.value).toBe(true)
    })
  })
})
