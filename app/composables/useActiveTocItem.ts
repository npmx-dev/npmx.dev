import type { TocItem } from '#shared/types/readme'
import type { Ref } from 'vue'

/**
 * Composable for tracking the currently visible heading in a TOC.
 * Uses IntersectionObserver to detect which heading is at the top of the viewport.
 *
 * @param toc - Reactive array of TOC items
 * @returns Object containing activeId
 * @public
 */
export function useActiveTocItem(toc: Ref<TocItem[]>) {
  const activeId = ref<string | null>(null)

  // Only run observer logic on client
  if (import.meta.server) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    return { activeId }
  }

  let observer: IntersectionObserver | null = null
  const headingElements = new Map<string, Element>()

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
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  return { activeId }
}
