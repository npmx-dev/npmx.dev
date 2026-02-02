/**
 * Redirect legacy URLs to canonical paths (client-side only)
 *
 * - /package/code/* → /package-code/*
 * - /code/* → /package-code/*
 * - /package/docs/* → /package-docs/*
 * - /docs/* → /package-docs/*
 * - /org/* → /@*
 * - /* → /package/* (Unless its an existing page)
 */
export default defineNuxtRouteMiddleware(to => {
  // Only redirect on client-side to avoid breaking crawlers mid-transition
  if (import.meta.server) return

  const path = to.path

  // /package/code/* → /package-code/*
  if (path.startsWith('/package/code/')) {
    return navigateTo(path.replace('/package/code/', '/package-code/'), { replace: true })
  }
  // /code/* → /package-code/*
  if (path.startsWith('/code/')) {
    return navigateTo(path.replace('/code/', '/package-code/'), { replace: true })
  }

  // /package/docs/* → /package-docs/*
  if (path.startsWith('/package/docs/')) {
    return navigateTo(path.replace('/package/docs/', '/package-docs/'), { replace: true })
  }
  // /docs/* → /package-docs/*
  if (path.startsWith('/docs/')) {
    return navigateTo(path.replace('/docs/', '/package-docs/'), { replace: true })
  }

  // /org/* → /@*
  if (path.startsWith('/org/')) {
    return navigateTo(path.replace('/org/', '/@'), { replace: true })
  }

  // Keep this one last as it will catch everything
  // /* → /package/* (Unless its an existing page)
  if (path.startsWith('/') && !path.startsWith('/package/')) {
    const router = useRouter()
    const resolved = router.resolve(path)
    if (resolved?.matched?.length === 1 && resolved.matched[0]?.path === '/:package(.*)*') {
      return navigateTo(`/package${path}`, { replace: true })
    }
  }
})
