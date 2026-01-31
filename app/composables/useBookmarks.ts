import type { RemovableRef } from '@vueuse/core'
import { useLocalStorage } from '@vueuse/core'

/**
 * Bookmark entry with package name and timestamp
 */
export interface Bookmark {
  packageName: string
  addedAt: number
}

const STORAGE_KEY = 'npmx-bookmarks'

// Shared bookmarks instance (singleton per app)
let bookmarksRef: RemovableRef<Bookmark[]> | null = null

/**
 * Composable for managing package bookmarks with localStorage persistence.
 * Bookmarks are shared across all components that use this composable.
 */
export function useBookmarks() {
  if (!bookmarksRef) {
    bookmarksRef = useLocalStorage<Bookmark[]>(STORAGE_KEY, [], {
      mergeDefaults: true,
    })
  }

  const bookmarks = bookmarksRef

  /**
   * Check if a package is bookmarked
   */
  function isBookmarked(packageName: string): boolean {
    return bookmarks.value.some(b => b.packageName === packageName)
  }

  /**
   * Reactive computed to check if a specific package is bookmarked
   */
  function useIsBookmarked(packageName: MaybeRefOrGetter<string>) {
    return computed(() => isBookmarked(toValue(packageName)))
  }

  /**
   * Add a package to bookmarks
   */
  function addBookmark(packageName: string): void {
    if (!isBookmarked(packageName)) {
      bookmarks.value = [{ packageName, addedAt: Date.now() }, ...bookmarks.value]
    }
  }

  /**
   * Remove a package from bookmarks
   */
  function removeBookmark(packageName: string): void {
    bookmarks.value = bookmarks.value.filter(b => b.packageName !== packageName)
  }

  /**
   * Toggle bookmark status for a package
   */
  function toggleBookmark(packageName: string): void {
    if (isBookmarked(packageName)) {
      removeBookmark(packageName)
    } else {
      addBookmark(packageName)
    }
  }

  /**
   * Clear all bookmarks
   */
  function clearBookmarks(): void {
    bookmarks.value = []
  }

  const bookmarkCount = computed(() => bookmarks.value.length)
  const hasBookmarks = computed(() => bookmarks.value.length > 0)

  return {
    bookmarks,
    bookmarkCount,
    hasBookmarks,
    isBookmarked,
    useIsBookmarked,
    addBookmark,
    removeBookmark,
    toggleBookmark,
    clearBookmarks,
  }
}
