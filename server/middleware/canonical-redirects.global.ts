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
  '/opensearch.xml',
  '/about',
  '/accessibility',
  '/blog',
  '/brand',
  '/compare',
  '/org',
  '/package',
  '/package-code',
  '/package-docs',
  '/pds',
  '/privacy',
  '/search',
  '/settings',
  '/translation-status',
  '/recharging',
]

const cacheControl = 's-maxage=3600, stale-while-revalidate=36000'

export default defineEventHandler(async event => {
  const [path = '/', query] = event.path.split('?')

  if (query) {
    const params = new URLSearchParams(query)

    switch (params.get('activeTab')) {
      case 'versions': {
        // /package/name?activeTab=versions → /package/name/versions
        // /package/@scope/name?activeTab=versions → /package/@scope/name/versions

        const pkgPathMatch = path.match(/^\/package\/((?:@[^/]+\/)?[^/]+)$/)
        if (pkgPathMatch) {
          params.delete('activeTab')
          const remaining = params.toString()
          setHeader(event, 'cache-control', cacheControl)
          return sendRedirect(
            event,
            `/package/${pkgPathMatch[1]}/versions` + (remaining ? '?' + remaining : ''),
            301,
          )
        }
        break
      }
    }
  }

  const routeRules = getRouteRules(event)
  if (Object.keys(routeRules).length > 1) {
    return
  }

  // username
  if (path.startsWith('/~') || path.startsWith('/_')) {
    return
  }

  if (pages.some(page => path === page || path.startsWith(page + '/'))) {
    return
  }

  // /@org/pkg or /pkg → /package/org/pkg or /package/pkg
  let pkgMatch = path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)$/)
  if (pkgMatch?.groups) {
    const args = [pkgMatch.groups.org, pkgMatch.groups.name].filter(Boolean).join('/')
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(event, `/package/${args}` + (query ? '?' + query : ''), 301)
  }

  // /@org/pkg/v/version or /@org/pkg@version → /package/org/pkg/v/version
  // /pkg/v/version or /pkg@version → /package/pkg/v/version
  const pkgVersionMatch =
    path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)\/v\/(?<version>[^/]+)$/) ||
    path.match(/^\/(?:(?<org>@[^/]+)\/)?(?<name>[^/@]+)@(?<version>[^/]+)$/)

  if (pkgVersionMatch?.groups) {
    const args = [pkgVersionMatch.groups.org, pkgVersionMatch.groups.name].filter(Boolean).join('/')
    setHeader(event, 'cache-control', cacheControl)
    return sendRedirect(
      event,
      `/package/${args}/v/${pkgVersionMatch.groups.version}` + (query ? '?' + query : ''),
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
