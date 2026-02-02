/**
 * Removes trailing slashes from URLs.
 *
 * This middleware only runs in development to maintain consistent behavior.
 * In production, Vercel handles this redirect via vercel.json.
 *
 * - /package/vue/ → /package/vue
 * - /docs/getting-started/?query=value → /docs/getting-started?query=value
 */
export default defineNuxtRouteMiddleware(to => {
  if (!import.meta.dev) return

  if (to.path !== '/' && to.path.endsWith('/')) {
    return navigateTo(
      {
        path: to.path.slice(0, -1),
        query: to.query,
        hash: to.hash,
      },
      { replace: true },
    )
  }
})
