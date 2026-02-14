interface UseScrollToTopOptions {
  /**
   * Duration of the scroll animation in milliseconds.
   */
  duration?: number
}

/**
 * Scroll to the top of the page with a smooth animation.
 * @param options - Configuration options for the scroll animation.
 * @returns An object containing the scrollToTop function and a cancel function.
 */
export function useScrollToTop(options: UseScrollToTopOptions) {
  const { duration = 500 } = options

  // Check if prefers-reduced-motion is enabled
  const preferReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  // Easing function for the scroll animation
  const easeOutQuad = (t: number) => t * (2 - t)

  /**
   * Active requestAnimationFrame id for the current auto-scroll animation
   */
  let rafId: number | null = null
  /**
   * Disposer for temporary interaction listeners attached during auto-scroll
   */
  let stopInteractionListeners: (() => void) | null = null

  function cleanupInteractionListeners() {
    if (stopInteractionListeners) {
      stopInteractionListeners()
      stopInteractionListeners = null
    }
  }

  /**
   * Stop any in-flight auto-scroll before starting a new one.
   */
  function cancel() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    cleanupInteractionListeners()
  }

  function scrollToTop() {
    cancel()

    if (preferReducedMotion.value) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }

    const start = window.scrollY
    if (start <= 0) return

    const startTime = performance.now()
    const change = -start

    const cleanup = [
      useEventListener(window, 'wheel', cancel, { passive: true }),
      useEventListener(window, 'touchstart', cancel, { passive: true }),
      useEventListener(window, 'mousedown', cancel, { passive: true }),
    ]

    stopInteractionListeners = () => cleanup.forEach(stop => stop())

    // Start the frame-by-frame scroll animation.
    function animate() {
      const elapsed = performance.now() - startTime
      const t = Math.min(elapsed / duration, 1)
      const y = start + change * easeOutQuad(t)

      window.scrollTo({ top: y })

      if (t < 1) {
        rafId = requestAnimationFrame(animate)
      } else {
        cancel()
      }
    }

    rafId = requestAnimationFrame(animate)
  }

  onBeforeUnmount(cancel)

  return {
    scrollToTop,
    cancel,
  }
}
