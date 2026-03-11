// Easing function for the scroll animation
const easeOutQuad = (t: number) => t * (2 - t)

export const SCROLL_TO_TOP_THRESHOLD = 300
const SCROLL_TO_TOP_DURATION = 500

/**
 * Scroll to the top of the page with a smooth animation.
 * @param options - Configuration options for the scroll animation.
 * @returns An object containing the scrollToTop function and a cancel function.
 */
export const useScrollToTop = createSharedComposable(function useScrollToTop() {
  // Check if prefers-reduced-motion is enabled
  const preferReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')

  /**
   * Active requestAnimationFrame id for the current auto-scroll animation
   */
  let rafId: number | null = null
  const isScrolling = ref(false)

  /**
   * Stop any in-flight auto-scroll before starting a new one.
   */
  function cancel() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    isScrolling.value = false
  }

  // Cancel scroll on user interaction
  const onInteraction = () => {
    if (isScrolling.value) {
      cancel()
    }
  }

  if (import.meta.client) {
    const listenerOptions = { passive: true }
    useEventListener(window, 'wheel', onInteraction, listenerOptions)
    useEventListener(window, 'touchstart', onInteraction, listenerOptions)
    useEventListener(window, 'mousedown', onInteraction, listenerOptions)
  }

  function scrollToTop() {
    cancel()

    if (preferReducedMotion.value) {
      window.scrollTo({ top: 0, behavior: 'instant' })
      return
    }

    const start = window.scrollY
    if (start <= 0) return

    isScrolling.value = true

    const startTime = performance.now()
    const change = -start

    // Start the frame-by-frame scroll animation.
    function animate() {
      const elapsed = performance.now() - startTime
      const t = Math.min(elapsed / SCROLL_TO_TOP_DURATION, 1)
      const y = start + change * easeOutQuad(t)

      window.scrollTo({ top: y })

      if (t < 1 && isScrolling.value) {
        rafId = requestAnimationFrame(animate)
      } else {
        cancel()
      }
    }

    rafId = requestAnimationFrame(animate)
  }

  tryOnScopeDispose(cancel)

  const isTouchDeviceClient = shallowRef(false)
  onMounted(() => {
    isTouchDeviceClient.value = isTouchDevice()
  })

  return {
    scrollToTop,
    cancel,
    isTouchDeviceClient,
  }
})
