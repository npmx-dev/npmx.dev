/**
 * Scoped View Transitions plugin.
 *
 * Only triggers the View Transition API when navigating between `/` and `/search`
 * (the search-box morph animation). All other navigations are left untouched so
 * they feel instant.
 */
export default defineNuxtPlugin(nuxtApp => {
  if (!document.startViewTransition) return

  let transition: ViewTransition | undefined
  let finishTransition: (() => void) | undefined
  let hasUAVisualTransition = false

  const resetTransitionState = () => {
    transition = undefined
    finishTransition = undefined
    hasUAVisualTransition = false
  }

  // Respect browser-initiated visual transitions (e.g. swipe-back)
  window.addEventListener('popstate', event => {
    hasUAVisualTransition =
      (event as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition ?? false
    if (hasUAVisualTransition) {
      transition?.skipTransition()
    }
  })

  const router = useRouter()

  router.beforeResolve(async (to, from) => {
    if (to.matched.length === 0) return

    const toPath = to.path
    const fromPath = from.path

    // Only transition between / and /search
    if (!isSearchTransition(toPath, fromPath)) return

    // Respect prefers-reduced-motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    // Skip if browser already handled the visual transition
    if (hasUAVisualTransition) return

    const promise = new Promise<void>(resolve => {
      finishTransition = resolve
    })

    let changeRoute: () => void
    const ready = new Promise<void>(resolve => (changeRoute = resolve))

    transition = document.startViewTransition(() => {
      changeRoute!()
      return promise
    })

    transition.finished.then(resetTransitionState)

    await nuxtApp.callHook('page:view-transition:start', transition)

    return ready
  })

  // Abort on errors
  router.onError(() => {
    finishTransition?.()
    resetTransitionState()
  })
  nuxtApp.hook('app:error', () => {
    finishTransition?.()
    resetTransitionState()
  })
  nuxtApp.hook('vue:error', () => {
    finishTransition?.()
    resetTransitionState()
  })

  // Finish when page render completes
  nuxtApp.hook('page:finish', () => {
    finishTransition?.()
    resetTransitionState()
  })
})

/** Return true when navigating between `/` and `/search` (either direction). */
function isSearchTransition(toPath: string, fromPath: string): boolean {
  const paths = new Set([toPath, fromPath])
  return paths.has('/') && paths.has('/search')
}
