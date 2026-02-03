import type { TocItem } from '#shared/types/readme'
import type { Ref } from 'vue'
import { scrollToAnchor } from '~/utils/scrollToAnchor'

/**
 * Composable for tracking the currently visible heading in a TOC.
 * Uses IntersectionObserver to detect which heading is at the top of the viewport.
 *
 * @param toc - Reactive array of TOC items
 * @returns Object containing activeId and scrollToHeading function
 * @public
 */
export function useActiveTocItem(toc: Ref<TocItem[]>) {
  const activeId = ref<string | null>(null)

  // Only run observer logic on client
  if (import.meta.server) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { activeId, scrollToHeading: (_id: string) => {} }
  }

  let observer: IntersectionObserver | null = null
  const headingElements = new Map<string, Element>()
  let scrollCleanup: (() => void) | null = null

  const setupObserver = () => {
    // Clean up previous observer
    if (observer) {
      observer.disconnect()
    }
    headingElements.clear()

    // Find all heading elements that match TOC IDs
    const ids = toc.value.map(item => item.id)
    if (ids.length === 0) return

    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) {
        headingElements.set(id, el)
      }
    }

    if (headingElements.size === 0) return

    // Create observer that triggers when headings cross the top 20% of viewport
    observer = new IntersectionObserver(
      entries => {
        // Get all visible headings sorted by their position
        const visibleHeadings: { id: string; top: number }[] = []

        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleHeadings.push({
              id: entry.target.id,
              top: entry.boundingClientRect.top,
            })
          }
        }

        // If there are visible headings, pick the one closest to the top
        if (visibleHeadings.length > 0) {
          visibleHeadings.sort((a, b) => a.top - b.top)
          activeId.value = visibleHeadings[0]?.id ?? null
        } else {
          // No headings visible in intersection zone - find the one just above viewport
          const headingsWithPosition: { id: string; top: number }[] = []
          for (const [id, el] of headingElements) {
            const rect = el.getBoundingClientRect()
            headingsWithPosition.push({ id, top: rect.top })
          }

          // Find the heading that's closest to (but above) the viewport top
          const aboveViewport = headingsWithPosition
            .filter(h => h.top < 100) // Allow some buffer
            .sort((a, b) => b.top - a.top) // Sort descending (closest to top first)

          if (aboveViewport.length > 0) {
            activeId.value = aboveViewport[0]?.id ?? null
          }
        }
      },
      {
        rootMargin: '-80px 0px -70% 0px', // Trigger in top ~30% of viewport (accounting for header)
        threshold: 0,
      },
    )

    // Observe all heading elements
    for (const el of headingElements.values()) {
      observer.observe(el)
    }
  }

  // Scroll to a heading with observer disconnection during scroll
  const scrollToHeading = (id: string) => {
    if (!document.getElementById(id)) return

    // Clean up any previous scroll monitoring
    if (scrollCleanup) {
      scrollCleanup()
      scrollCleanup = null
    }

    // Immediately set activeId
    activeId.value = id

    // Disconnect observer to prevent interference during scroll
    if (observer) {
      observer.disconnect()
    }

    // Scroll, but do not update url until scroll ends
    scrollToAnchor(id, { updateUrl: false })

    const handleScrollEnd = () => {
      history.replaceState(null, '', `#${id}`)
      setupObserver()
      scrollCleanup = null
    }

    // Check for scrollend support (Chrome 114+, Firefox 109+, Safari 18+)
    const supportsScrollEnd = 'onscrollend' in window

    if (supportsScrollEnd) {
      window.addEventListener('scrollend', handleScrollEnd, { once: true })
      scrollCleanup = () => window.removeEventListener('scrollend', handleScrollEnd)
    } else {
      // Fallback: use RAF polling for older browsers
      let lastScrollY = window.scrollY
      let stableFrames = 0
      let rafId: number | null = null
      const STABLE_THRESHOLD = 5 // Number of frames with no movement to consider settled

      const checkScrollSettled = () => {
        const currentScrollY = window.scrollY

        if (Math.abs(currentScrollY - lastScrollY) < 1) {
          stableFrames++
          if (stableFrames >= STABLE_THRESHOLD) {
            handleScrollEnd()
            return
          }
        } else {
          stableFrames = 0
        }

        lastScrollY = currentScrollY
        rafId = requestAnimationFrame(checkScrollSettled)
      }

      rafId = requestAnimationFrame(checkScrollSettled)

      scrollCleanup = () => {
        if (rafId !== null) {
          cancelAnimationFrame(rafId)
          rafId = null
        }
      }
    }

    // Safety timeout - reconnect observer after max scroll time
    setTimeout(() => {
      if (scrollCleanup) {
        scrollCleanup()
        scrollCleanup = null
        history.replaceState(null, '', `#${id}`)
        setupObserver()
      }
    }, 1000)
  }

  // Set up observer when TOC changes
  watch(
    toc,
    () => {
      // Use nextTick to ensure DOM is updated
      nextTick(setupObserver)
    },
    { immediate: true },
  )

  // Clean up on unmount
  onUnmounted(() => {
    if (scrollCleanup) {
      scrollCleanup()
      scrollCleanup = null
    }
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  return { activeId, scrollToHeading }
}
