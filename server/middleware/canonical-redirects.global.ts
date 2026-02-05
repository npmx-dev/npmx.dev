/**
 * Redirect legacy URLs to canonical paths (client-side only)
 *
 * - /package/code/* → /package-code/*
 * - /code/* → /package-code/*
 * - /package/docs/* → /package-docs/*
 * - /docs/* → /package-docs/*
 * - /org/* → /@*
 * - /* → /package/* (Unless it's an existing page)
 */
const pages = [
  '/about',
  '/compare',
  '/org',
  '/package',
  '/package-code',
  '/package-docs',
  '/privacy',
  '/search',
  '/settings',
]
export default defineEventHandler(async event => {
  const path = event.path.split('?')[0]!

  // username
  if (path.startsWith('/~')) {
    return
  }

  if (pages.some(page => path === page || path.startsWith(page + '/'))) {
    return
  }

  // /@org/pkg or /pkg → /package/org/pkg or /package/pkg
  let pkgMatch = path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)$/)
  if (pkgMatch?.groups) {
    const args = [pkgMatch.groups.org, pkgMatch.groups.name].filter(Boolean).join('/')
    return sendRedirect(event, `/package/${args}`)
  }

  // /@org/pkg/v/version or /@org/pkg@version → /package/org/pkg/v/version
  // /pkg/v/version or /pkg@version → /package/pkg/v/version
  const pkgVersionMatch =
    path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)\/v\/(?<version>[^/]+)$/) ||
    path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)@(?<version>[^/]+)$/)

  if (pkgVersionMatch?.groups) {
    const args = [pkgVersionMatch.groups.org, pkgVersionMatch.groups.name].filter(Boolean).join('/')
    return sendRedirect(event, `/package/${args}/v/${pkgVersionMatch.groups.version}`)
  }

  // /org/* → /@*
  const orgMatch = path.match(/^\/@(?<org>[^/]+)$/)
  if (orgMatch?.groups) {
    return sendRedirect(event, `/org/${orgMatch.groups.org}`)
  }
})
