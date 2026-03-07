import type { RouterConfig } from 'nuxt/schema'

export default {
  scrollBehavior(to, from, savedPosition) {
    // If the browser has a saved position (e.g. back/forward navigation), restore it
    if (savedPosition) {
      return savedPosition
    }

    // Scroll to top when main search query changes
    if (to.path === '/search' && to.query.q !== from.query.q) {
      return { left: 0, top: 0 }
    }

    // Don't scroll for other param changes (filters, pagination, etc.)
    if (to.path === from.path) {
      return false
    }

    // If navigating to a hash anchor, scroll to it
    if (to.hash) {
      const { scrollMargin } = to.meta
      return {
        el: to.hash,
        behavior: 'smooth',
        top: typeof scrollMargin === 'number' ? scrollMargin : 70,
      }
    }

    // Otherwise, scroll to the top of the page
    return { left: 0, top: 0 }
  },
} satisfies RouterConfig
