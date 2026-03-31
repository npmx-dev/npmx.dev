import { useEventListener } from '@vueuse/core'

/**
 * Composable for keyboard navigation through search results and package lists
 *
 * Provides arrow key navigation (ArrowUp/ArrowDown) and Enter key support
 * for navigating through focusable result elements.
 *
 * @param options - Configuration options
 * @param options.includeSuggestions - Whether to include suggestion elements (data-suggestion-index)
 * @param options.onArrowUpAtStart - Optional callback when ArrowUp is pressed at the first element
 */
export function useResultsKeyboardNavigation(options?: {
  includeSuggestions?: boolean
  onArrowUpAtStart?: () => void
}) {
  const keyboardShortcuts = useKeyboardShortcuts()

  const isVisible = (el: HTMLElement) => el.getClientRects().length > 0

  /**
   * Get all focusable result elements in DOM order
   */
  function getFocusableElements(): HTMLElement[] {
    const elements: HTMLElement[] = []

    // Include suggestions if enabled (used on search page)
    if (options?.includeSuggestions) {
      const suggestions = Array.from(
        document.querySelectorAll<HTMLElement>('[data-suggestion-index]'),
      )
        .filter(isVisible)
        .sort((a, b) => {
          const aIdx = Number.parseInt(a.dataset.suggestionIndex ?? '0', 10)
          const bIdx = Number.parseInt(b.dataset.suggestionIndex ?? '0', 10)
          return aIdx - bIdx
        })
      elements.push(...suggestions)
    }

    // Always include package results
    const packages = Array.from(document.querySelectorAll<HTMLElement>('[data-result-index]'))
      .filter(isVisible)
      .sort((a, b) => {
        const aIdx = Number.parseInt(a.dataset.resultIndex ?? '0', 10)
        const bIdx = Number.parseInt(b.dataset.resultIndex ?? '0', 10)
        return aIdx - bIdx
      })
    elements.push(...packages)

    return elements
  }

  /**
   * Focus an element and scroll it into view if needed
   */
  function focusElement(el: HTMLElement) {
    el.focus({ preventScroll: true })

    // Only scroll if element is not already in viewport
    const rect = el.getBoundingClientRect()
    const isInViewport =
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)

    if (!isInViewport) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Only handle arrow keys and Enter
    if (!['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) {
      return
    }

    if (!keyboardShortcuts.value) {
      return
    }

    const elements = getFocusableElements()
    const currentIndex = elements.findIndex(el => el === document.activeElement)

    if (e.key === 'ArrowDown') {
      // If there are results available, handle navigation
      if (elements.length > 0) {
        e.preventDefault()
        e.stopPropagation()

        // If no result is focused, focus the first one
        if (currentIndex < 0) {
          const firstEl = elements[0]
          if (firstEl) focusElement(firstEl)
          return
        }

        // If a result is already focused, move to the next one
        const nextIndex = Math.min(currentIndex + 1, elements.length - 1)
        const el = elements[nextIndex]
        if (el) focusElement(el)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      // Only intercept if a result is already focused
      if (currentIndex >= 0) {
        e.preventDefault()
        e.stopPropagation()

        // At first result
        if (currentIndex === 0) {
          // Call custom callback if provided (e.g., return focus to search input)
          if (options?.onArrowUpAtStart) {
            options.onArrowUpAtStart()
          }
          return
        }
        const nextIndex = currentIndex - 1
        const el = elements[nextIndex]
        if (el) focusElement(el)
      }
      return
    }

    if (e.key === 'Enter') {
      // Handle Enter on focused card - click the main link inside
      if (document.activeElement && elements.includes(document.activeElement as HTMLElement)) {
        const card = document.activeElement as HTMLElement
        // Find the first link inside the card and click it
        const link = card.querySelector('a')
        if (link) {
          e.preventDefault()
          e.stopPropagation()
          link.click()
        }
      }
    }
  }

  // Register keyboard event listeners using useEventListener for better control
  // Use capture phase to intercept before other handlers
  useEventListener(document, 'keydown', handleKeydown, { capture: true })

  return {
    getFocusableElements,
    focusElement,
  }
}
