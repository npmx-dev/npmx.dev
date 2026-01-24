/**
 * Redirect legacy URLs to canonical paths (client-side only)
 *
 * - /package/* → /*
 * - /package/code/* → /code/*
 * - /org/* → /@*
 */
export default defineNuxtRouteMiddleware(to => {
  // Only redirect on client-side to avoid breaking crawlers mid-transition
  if (import.meta.server) return

  const path = to.path

  // /package/code/* → /code/*
  if (path.startsWith('/package/code/')) {
    return navigateTo(path.replace('/package/code/', '/code/'), { replace: true })
  }

  // /package/* → /*
  if (path.startsWith('/package/')) {
    return navigateTo(path.replace('/package/', '/'), { replace: true })
  }

  // /org/* → /@*
  if (path.startsWith('/org/')) {
    return navigateTo(path.replace('/org/', '/@'), { replace: true })
  }
})
