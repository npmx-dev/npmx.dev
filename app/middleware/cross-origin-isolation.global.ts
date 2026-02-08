/**
 * Forces a full-page load when navigating to or from /impact/ routes.
 *
 * The /impact/ routes require Cross-Origin-Opener-Policy and
 * Cross-Origin-Embedder-Policy headers for SharedArrayBuffer support.
 * These headers are only set on /impact/** responses (via routeRules),
 * so client-side navigations across this boundary would either miss
 * the headers (navigating in) or retain a stale context (navigating out).
 */
export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server) return

  const toImpact = to.path.startsWith('/impact')
  const fromImpact = from.path.startsWith('/impact')

  if (toImpact !== fromImpact) {
    return navigateTo(to.fullPath, { external: true })
  }
})
