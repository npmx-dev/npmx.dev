import type { RouterConfig } from 'nuxt/schema'

export default {
  scrollBehavior(to, _from, savedPosition) {
    // If the browser has a saved position (e.g. back/forward navigation), restore it

    if (savedPosition) {
      return savedPosition
    }

    // Preserve the current viewport for query-only updates on pages that opt in,
    // such as compare where controls sync state to the URL in-place.
    if (
      to.path === _from.path &&
      to.hash === _from.hash &&
      to.meta.preserveScrollOnQuery === true
    ) {
      return false
    }

    // If navigating to a hash anchor, scroll to it
    if (to.hash) {
      const { scrollMargin } = to.meta
      return {
        el: to.hash,
        behavior: 'smooth',
        top: typeof scrollMargin == 'number' ? scrollMargin : 70,
      }
    }

    // Otherwise, scroll to the top of the page
    return { left: 0, top: 0 }
  },
} satisfies RouterConfig
