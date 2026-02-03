export interface ScrollToAnchorOptions {
  /** Custom scroll function (e.g., from useActiveTocItem) */
  scrollFn?: (id: string) => void
  /** Whether to update the URL hash (default: true) */
  updateUrl?: boolean
}

/**
 * Scroll to an element by ID, using a custom scroll function if provided,
 * otherwise falling back to default scroll behavior with header offset.
 *
 * @param id - The element ID to scroll to
 * @param options - Optional configuration for scroll behavior
 */
export function scrollToAnchor(id: string, options?: ScrollToAnchorOptions): void {
  const { scrollFn, updateUrl = true } = options ?? {}

  // Use custom scroll function if provided
  if (scrollFn) {
    scrollFn(id)
    return
  }

  // Fallback: scroll with header offset
  const element = document.getElementById(id)
  if (!element) return

  // Calculate scroll position with header offset (matches scroll-padding-top in main.css)
  const HEADER_OFFSET = 80
  const PKG_STICKY_HEADER_OFFSET = 52
  const elementTop = element.getBoundingClientRect().top + window.scrollY
  const targetScrollY = elementTop - (HEADER_OFFSET + PKG_STICKY_HEADER_OFFSET)

  // Use scrollTo for precise control
  window.scrollTo({
    top: targetScrollY,
    behavior: 'smooth',
  })

  // Update URL hash after initiating scroll
  // Use replaceState to avoid triggering native scroll-to-anchor behavior
  if (updateUrl) {
    history.replaceState(null, '', `#${id}`)
  }
}
