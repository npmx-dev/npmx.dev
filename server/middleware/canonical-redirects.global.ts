import { NPM_REGISTRY } from '#shared/utils/constants'

/**
 * Redirect legacy/shorthand URLs to canonical paths.
 *
 * Handled here:
 * - /@org/pkg or /pkg           → /package/@org/pkg or /package/pkg
 * - /@org/pkg/v/ver or /pkg@ver → /package/@org/pkg/v/ver or /package/pkg/v/ver
 * - /@org                       → /org/org
 * - /org/<name>                 → /~<name> (when <name> is a user account, not an org)
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
  '/noodles',
  '/sponsors',
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

  // /org/<name> → /~<name> if <name> is a user, not an org (matches npmjs.com).
  // NOTE: this must run before the `pages` allowlist check below, since '/org'
  // is allowlisted (to protect bare `/org` from the generic /pkg redirect).
  // Only exact single-segment /org/<name> paths are checked here; bare `/org`
  // and deeper paths still fall through to the allowlist.
  // Detection uses /-/org/<name>/user ({} = real org, non-empty = user,
  // 404 = neither) — /-/org/<name>/package returns 200 for users too, so it
  // cannot be used for detection.
  const orgPageMatch = path.match(/^\/org\/(?<name>[^/]+)$/)
  const orgPageName = orgPageMatch?.groups?.name
  if (orgPageName) {
    const name = orgPageName.toLowerCase()
    try {
      const data = await $fetch<Record<string, string>>(
        `${NPM_REGISTRY}/-/org/${encodeURIComponent(name)}/user`,
      )
      if (Object.keys(data).length > 0) {
        setHeader(event, 'cache-control', cacheControl)
        return sendRedirect(event, `/~${name}` + (query ? '?' + query : ''), 301)
      }
      // {} means real org — fall through, let the org page render as normal
    } catch {
      // 404 (name doesn't exist) or any other error — fall through,
      // let the org page's own 404 handling take over. Do not throw
      // here; a failure in this check must never block rendering the
      // org page itself.
    }
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
