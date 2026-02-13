/**
 * Redirect legacy/shorthand URLs to canonical paths.
 *
 * Handled here:
 * - /@org/pkg or /pkg           → /package/@org/pkg or /package/pkg
 * - /@org/pkg/v/ver or /pkg@ver → /package/@org/pkg/v/ver or /package/pkg/v/ver
 * - /@org                       → /org/org
 *
 * Handled via route aliases (not here):
 * - /package/code/* → /package-code/*
 * - /code/*         → /package-code/*
 * - /package/docs/* → /package-docs/*
 * - /docs/*         → /package-docs/*
 */
const pages = [
  '/oauth-client-metadata.json',
  '/200.html',
  '/about',
  '/accessibility',
  '/compare',
  '/org',
  '/package',
  '/package-code',
  '/package-docs',
  '/privacy',
  '/search',
  '/settings',
]

const cacheControl = 's-maxage=3600, stale-while-revalidate=36000'

export default defineEventHandler(async event => {
  const routeRules = getRouteRules(event)
  if (Object.keys(routeRules).length > 1) {
    return
  }

  const [path = '/', query] = event.path.split('?')

  // username
  if (path.startsWith('/~') || path.startsWith('/_')) {
    return
  }

  if (pages.some(page => path === page || path.startsWith(page + '/'))) {
    return
  }

  // /llms.txt at root is handled by the llm-docs middleware
  if (path === '/llms.txt') {
    return
  }

  // /@org/pkg or /pkg → /package/org/pkg or /package/pkg
  // Also handles trailing /llms.txt or /llms_full.txt suffixes
  let pkgMatch = path.match(
    /^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+?)(?<suffix>\.md|\/(?:llms\.txt|llms_full\.txt))?$/,
  )
  if (pkgMatch?.groups) {
    const args = [pkgMatch.groups.org, pkgMatch.groups.name].filter(Boolean).join('/')
    const suffix = pkgMatch.groups.suffix ?? ''
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(event, `/package/${args}${suffix}` + (query ? '?' + query : ''), 301)
  }

  // /@org/pkg/v/version or /@org/pkg@version → /package/org/pkg/v/version
  // /pkg/v/version or /pkg@version → /package/pkg/v/version
  // Also handles trailing /llms.txt or /llms_full.txt suffixes
  const pkgVersionMatch =
    path.match(
      /^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)\/v\/(?<version>[^/]+)(?<suffix>\/(?:llms\.txt|llms_full\.txt))?$/,
    ) ||
    path.match(
      /^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)@(?<version>[^/]+)(?<suffix>\/(?:llms\.txt|llms_full\.txt))?$/,
    )

  if (pkgVersionMatch?.groups) {
    const args = [pkgVersionMatch.groups.org, pkgVersionMatch.groups.name].filter(Boolean).join('/')
    const versionSuffix = pkgVersionMatch.groups.suffix ?? ''
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(
      event,
      `/package/${args}/v/${pkgVersionMatch.groups.version}${versionSuffix}` +
        (query ? '?' + query : ''),
      301,
    )
  }

  // /@org → /org/org
  const orgMatch = path.match(/^\/@(?<org>[^/]+)$/)
  if (orgMatch?.groups) {
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(event, `/org/${orgMatch.groups.org}` + (query ? '?' + query : ''), 301)
  }
})
