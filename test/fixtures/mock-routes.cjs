/**
 * Shared route mock handlers for external API requests.
 *
 * This module contains the URL matching and response generation logic used by both:
 * - Playwright E2E tests (test/e2e/test-utils.ts)
 * - Lighthouse CI puppeteer setup (lighthouse-setup.cjs)
 *
 * It is intentionally written as CJS so it can be required from the CJS lighthouse
 * setup script and imported from ESM test utilities.
 */

'use strict'

const { existsSync, readFileSync } = require('node:fs')
const { join } = require('node:path')

const FIXTURES_DIR = join(__dirname)

/**
 * @param {string} relativePath
 * @returns {unknown | null}
 */
function readFixture(relativePath) {
  const fullPath = join(FIXTURES_DIR, relativePath)
  if (!existsSync(fullPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Parse a scoped package name into its components.
 * Handles formats like: @scope/name, @scope/name@version, name, name@version
 *
 * @param {string} input
 * @returns {{ name: string; version?: string }}
 */
function parseScopedPackage(input) {
  if (input.startsWith('@')) {
    const slashIndex = input.indexOf('/')
    if (slashIndex === -1) {
      return { name: input }
    }
    const afterSlash = input.slice(slashIndex + 1)
    const atIndex = afterSlash.indexOf('@')
    if (atIndex === -1) {
      return { name: input }
    }
    return {
      name: input.slice(0, slashIndex + 1 + atIndex),
      version: afterSlash.slice(atIndex + 1),
    }
  }

  const atIndex = input.indexOf('@')
  if (atIndex === -1) {
    return { name: input }
  }
  return {
    name: input.slice(0, atIndex),
    version: input.slice(atIndex + 1),
  }
}

/**
 * @param {string} packageName
 * @returns {string}
 */
function packageToFixturePath(packageName) {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.slice(1).split('/')
    if (!name) {
      return `npm-registry/packuments/${packageName}.json`
    }
    return `npm-registry/packuments/@${scope}/${name}.json`
  }
  return `npm-registry/packuments/${packageName}.json`
}

/**
 * @typedef {Object} MockResponse
 * @property {number} status
 * @property {string} contentType
 * @property {string} body
 */

/**
 * Determine the mock response for an npm registry request.
 *
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchNpmRegistry(urlString) {
  const url = new URL(urlString)
  const pathname = decodeURIComponent(url.pathname)

  // Search endpoint
  if (pathname === '/-/v1/search') {
    const query = url.searchParams.get('text')
    if (query) {
      const maintainerMatch = query.match(/^maintainer:(.+)$/)
      if (maintainerMatch && maintainerMatch[1]) {
        const fixture = readFixture(`users/${maintainerMatch[1]}.json`)
        return json(fixture || { objects: [], total: 0, time: new Date().toISOString() })
      }

      const searchName = query.replace(/:/g, '-')
      const fixture = readFixture(`npm-registry/search/${searchName}.json`)
      return json(fixture || { objects: [], total: 0, time: new Date().toISOString() })
    }
  }

  // Org packages
  const orgMatch = pathname.match(/^\/-\/org\/([^/]+)\/package$/)
  if (orgMatch && orgMatch[1]) {
    const fixture = readFixture(`npm-registry/orgs/${orgMatch[1]}.json`)
    if (fixture) {
      return json(fixture)
    }
    return json({ error: 'Not found' }, 404)
  }

  // Attestations endpoint - return empty attestations
  if (pathname.startsWith('/-/npm/v1/attestations/')) {
    return json({ attestations: [] })
  }

  // Packument
  if (!pathname.startsWith('/-/')) {
    let packageName = pathname.slice(1)

    if (packageName.startsWith('@')) {
      const parts = packageName.split('/')
      if (parts.length > 2) {
        packageName = `${parts[0]}/${parts[1]}`
      }
    } else {
      const slashIndex = packageName.indexOf('/')
      if (slashIndex !== -1) {
        packageName = packageName.slice(0, slashIndex)
      }
    }

    const fixture = readFixture(packageToFixturePath(packageName))
    if (fixture) {
      return json(fixture)
    }
    return json({ error: 'Not found' }, 404)
  }

  return null
}

/**
 * Determine the mock response for an npm API (downloads) request.
 *
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchNpmApi(urlString) {
  const url = new URL(urlString)
  const pathname = decodeURIComponent(url.pathname)

  // Downloads point
  const pointMatch = pathname.match(/^\/downloads\/point\/[^/]+\/(.+)$/)
  if (pointMatch && pointMatch[1]) {
    const packageName = pointMatch[1]
    const fixture = readFixture(`npm-api/downloads/${packageName}.json`)
    return json(
      fixture || {
        downloads: 0,
        start: '2025-01-01',
        end: '2025-01-31',
        package: packageName,
      },
    )
  }

  // Downloads range
  const rangeMatch = pathname.match(/^\/downloads\/range\/([^/]+)\/(.+)$/)
  if (rangeMatch && rangeMatch[1] && rangeMatch[2]) {
    const dateRange = rangeMatch[1]
    const packageName = rangeMatch[2]
    const [start, end] = dateRange.split(':')

    // Generate deterministic daily download data from the package name
    const seed = packageName.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
    const base = (seed % 9000) + 1000
    const downloads = []
    const startDate = new Date(start)
    const endDate = new Date(end)
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const day = d.toISOString().slice(0, 10)
      // Sine wave + noise for a realistic-looking sparkline
      const dayIndex = downloads.length
      const wave = Math.sin(dayIndex / 30) * base * 0.3
      const noise = Math.sin(dayIndex * 7 + seed) * base * 0.1
      downloads.push({ day, downloads: Math.max(0, Math.round(base + wave + noise)) })
    }

    return json({ downloads, start, end, package: packageName })
  }

  return null
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchOsvApi(urlString) {
  const url = new URL(urlString)

  if (url.pathname === '/v1/querybatch') {
    return json({ results: [] })
  }

  if (url.pathname.startsWith('/v1/query')) {
    return json({ vulns: [] })
  }

  return null
}

/**
 * Parse a package query string into name and specifier.
 * Handles scoped packages: "@scope/name@specifier" and "name@specifier".
 *
 * @param {string} query
 * @param {string} defaultSpecifier
 * @returns {{ name: string; specifier: string }}
 */
function parsePackageQuery(query, defaultSpecifier) {
  let name = query
  let specifier = defaultSpecifier
  if (name.startsWith('@')) {
    const atIndex = name.indexOf('@', 1)
    if (atIndex !== -1) {
      specifier = name.slice(atIndex + 1)
      name = name.slice(0, atIndex)
    }
  } else {
    const atIndex = name.indexOf('@')
    if (atIndex !== -1) {
      specifier = name.slice(atIndex + 1)
      name = name.slice(0, atIndex)
    }
  }
  return { name, specifier }
}

/**
 * Build a latest-version response for a single package (GET /:pkg endpoint).
 *
 * @param {string} query
 * @returns {object}
 */
function resolveSingleLatest(query) {
  const { name, specifier } = parsePackageQuery(query, 'latest')
  const packument = readFixture(packageToFixturePath(name))

  if (!packument) {
    return {
      name,
      specifier,
      version: '0.0.0',
      publishedAt: new Date().toISOString(),
      lastSynced: Date.now(),
    }
  }

  const distTags = packument['dist-tags']
  const versions = packument.versions

  let version
  if (specifier === 'latest' || !specifier) {
    version = distTags && distTags.latest
  } else if (distTags && distTags[specifier]) {
    version = distTags[specifier]
  } else if (versions && versions[specifier]) {
    version = specifier
  } else {
    version = distTags && distTags.latest
  }

  if (!version) {
    return {
      name,
      specifier,
      version: '0.0.0',
      publishedAt: new Date().toISOString(),
      lastSynced: Date.now(),
    }
  }

  return {
    name,
    specifier,
    version,
    publishedAt: (packument.time && packument.time[version]) || new Date().toISOString(),
    lastSynced: Date.now(),
  }
}

/**
 * Build a versions response for a single package (GET /versions/:pkg endpoint).
 *
 * @param {string} query
 * @returns {object}
 */
function resolveSingleVersions(query) {
  const { name, specifier } = parsePackageQuery(query, '*')
  const packument = readFixture(packageToFixturePath(name))

  if (!packument) {
    return { name, error: `"https://registry.npmjs.org/${name}": 404 Not Found` }
  }

  return {
    name,
    specifier,
    distTags: packument['dist-tags'] || {},
    versions: Object.keys(packument.versions || {}),
    time: packument.time || {},
    lastSynced: Date.now(),
  }
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchFastNpmMeta(urlString) {
  const url = new URL(urlString)
  let pathPart = decodeURIComponent(url.pathname.slice(1))

  if (!pathPart) return null

  // /versions/ endpoint returns version lists (used by getVersionsBatch)
  const isVersions = pathPart.startsWith('versions/')
  if (isVersions) pathPart = pathPart.slice('versions/'.length)

  const resolveFn = isVersions ? resolveSingleVersions : resolveSingleLatest

  // Batch requests: package1+package2+...
  if (pathPart.includes('+')) {
    const results = pathPart.split('+').map(resolveFn)
    return json(results)
  }

  return json(resolveFn(pathPart))
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchJsrRegistry(urlString) {
  const url = new URL(urlString)

  if (url.pathname.endsWith('/meta.json')) {
    return json(null)
  }

  return null
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchBundlephobiaApi(urlString) {
  const url = new URL(urlString)

  if (url.pathname === '/api/size') {
    const packageSpec = url.searchParams.get('package')
    if (packageSpec) {
      return json({
        name: packageSpec.split('@')[0],
        size: 12345,
        gzip: 4567,
        dependencyCount: 3,
      })
    }
  }

  return null
}

/**
 * @param {string} _urlString
 * @returns {MockResponse | null}
 */
function matchJsdelivrCdn(_urlString) {
  return { status: 404, contentType: 'text/plain', body: 'Not found' }
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchJsdelivrDataApi(urlString) {
  const url = new URL(urlString)
  const pathname = decodeURIComponent(url.pathname)

  const packageMatch = pathname.match(/^\/v1\/packages\/npm\/(.+)$/)
  if (packageMatch && packageMatch[1]) {
    const parsed = parseScopedPackage(packageMatch[1])

    const fixture = readFixture(`jsdelivr/${parsed.name}.json`)
    if (fixture) {
      return json(fixture)
    }

    return json({
      type: 'npm',
      name: parsed.name,
      version: parsed.version || 'latest',
      files: [
        { name: 'package.json', hash: 'abc123', size: 1000 },
        { name: 'index.js', hash: 'def456', size: 500 },
        { name: 'README.md', hash: 'ghi789', size: 2000 },
      ],
    })
  }

  return null
}

/**
 * @param {string} _urlString
 * @returns {MockResponse}
 */
function matchGravatarApi(_urlString) {
  return { status: 404, contentType: 'text/plain', body: 'Not found' }
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchUnghApi(urlString) {
  const url = new URL(urlString)

  const repoMatch = url.pathname.match(/^\/repos\/([^/]+)\/([^/]+)$/)
  if (repoMatch && repoMatch[1] && repoMatch[2]) {
    return json({
      repo: {
        description: `${repoMatch[1]}/${repoMatch[2]} - mock repo description`,
        stars: 1000,
        forks: 100,
        watchers: 50,
        defaultBranch: 'main',
      },
    })
  }

  return json(null)
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchConstellationApi(urlString) {
  const url = new URL(urlString)

  if (url.pathname === '/links/distinct-dids') {
    return json({ total: 0, linking_dids: [], cursor: undefined })
  }

  if (url.pathname === '/links/all') {
    return json({ links: {} })
  }

  if (url.pathname === '/xrpc/blue.microcosm.links.getBacklinks') {
    return json({ total: 0, records: [], cursor: undefined })
  }

  // Unknown constellation endpoint - return empty
  return json(null)
}

const BLUESKY_EMBED_DID = 'did:plc:2gkh62xvzokhlf6li4ol3b3d'

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchBlueskyApi(urlString) {
  const url = new URL(urlString)

  if (url.pathname === '/xrpc/com.atproto.identity.resolveHandle') {
    return json({ did: BLUESKY_EMBED_DID })
  }

  if (url.pathname === '/xrpc/app.bsky.feed.getPosts') {
    const requestedUri =
      url.searchParams.getAll('uris')[0] ||
      `at://${BLUESKY_EMBED_DID}/app.bsky.feed.post/3md3cmrg56k2r`

    return json({
      posts: [
        {
          uri: requestedUri,
          author: {
            did: BLUESKY_EMBED_DID,
            handle: 'danielroe.dev',
            displayName: 'Daniel Roe',
            avatar: `https://cdn.bsky.app/img/avatar/plain/${BLUESKY_EMBED_DID}/mock-avatar@jpeg`,
          },
          record: {
            text: 'Mock Bluesky post for CSP coverage.',
            createdAt: '2026-03-03T12:00:00.000Z',
          },
          embed: {
            $type: 'app.bsky.embed.images#view',
            images: [
              {
                thumb: `https://cdn.bsky.app/img/feed_thumbnail/plain/${BLUESKY_EMBED_DID}/mock-image@jpeg`,
                fullsize: `https://cdn.bsky.app/img/feed_fullsize/plain/${BLUESKY_EMBED_DID}/mock-image@jpeg`,
                alt: 'Mock Bluesky image',
                aspectRatio: { width: 1200, height: 630 },
              },
            ],
          },
          likeCount: 42,
          replyCount: 7,
          repostCount: 3,
        },
      ],
    })
  }

  if (url.pathname === '/xrpc/app.bsky.actor.getProfiles') {
    const actors = url.searchParams.getAll('actors')

    return json({
      profiles: actors.map(handle => ({
        handle,
        avatar: `https://cdn.bsky.app/img/avatar/plain/${BLUESKY_EMBED_DID}/mock-avatar`,
      })),
    })
  }

  return null
}

/**
 * @param {string} _urlString
 * @returns {MockResponse}
 */
function matchBlueskyCdn(_urlString) {
  return {
    status: 200,
    contentType: 'image/svg+xml',
    body:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">' +
      '<rect width="120" height="120" fill="#0ea5e9"/>' +
      '<circle cx="60" cy="44" r="18" fill="#f8fafc"/>' +
      '<rect x="24" y="74" width="72" height="18" rx="9" fill="#f8fafc"/>' +
      '</svg>',
  }
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchStarHistoryApi(urlString) {
  const url = new URL(urlString)

  if (url.pathname === '/svg') {
    return {
      status: 200,
      contentType: 'image/svg+xml',
      body:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320">' +
        '<rect width="640" height="320" fill="#0f172a"/>' +
        '<path d="M32 256 L160 220 L288 168 L416 120 L544 88 L608 64" stroke="#f59e0b" stroke-width="8" fill="none"/>' +
        '<text x="32" y="44" fill="#f8fafc" font-family="monospace" font-size="24">Mock Star History</text>' +
        '</svg>',
    }
  }

  return null
}

/**
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchGitHubApi(urlString) {
  const url = new URL(urlString)
  const pathname = url.pathname

  const contributorsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contributors$/)
  if (contributorsMatch) {
    const fixture = readFixture('github/contributors.json')
    return json(fixture || [])
  }

  // Commits endpoint
  const commitsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/commits$/)
  if (commitsMatch) {
    return json([{ sha: 'mock-commit' }])
  }

  // Search endpoint (issues, commits, etc.)
  const searchMatch = pathname.match(/^\/search\/(.+)$/)
  if (searchMatch) {
    return json({ total_count: 0, incomplete_results: false, items: [] })
  }

  return null
}

/**
 * Route definitions mapping URL patterns to their matchers.
 * Each entry has a pattern (for Playwright's page.route) and a match function
 * that returns a MockResponse or null.
 *
 * @type {Array<{ name: string; pattern: string; match: (url: string) => MockResponse | null }>}
 */
const routes = [
  { name: 'npm registry', pattern: 'https://registry.npmjs.org/**', match: matchNpmRegistry },
  { name: 'npm API', pattern: 'https://api.npmjs.org/**', match: matchNpmApi },
  { name: 'OSV API', pattern: 'https://api.osv.dev/**', match: matchOsvApi },
  { name: 'fast-npm-meta', pattern: 'https://npm.antfu.dev/**', match: matchFastNpmMeta },
  { name: 'JSR registry', pattern: 'https://jsr.io/**', match: matchJsrRegistry },
  { name: 'Bundlephobia API', pattern: 'https://bundlephobia.com/**', match: matchBundlephobiaApi },
  { name: 'jsdelivr CDN', pattern: 'https://cdn.jsdelivr.net/**', match: matchJsdelivrCdn },
  {
    name: 'jsdelivr Data API',
    pattern: 'https://data.jsdelivr.com/**',
    match: matchJsdelivrDataApi,
  },
  { name: 'Gravatar API', pattern: 'https://www.gravatar.com/**', match: matchGravatarApi },
  { name: 'GitHub API', pattern: 'https://api.github.com/**', match: matchGitHubApi },
  { name: 'UNGH API', pattern: 'https://ungh.cc/**', match: matchUnghApi },
  {
    name: 'Constellation API',
    pattern: 'https://constellation.microcosm.blue/**',
    match: matchConstellationApi,
  },
  { name: 'Bluesky API', pattern: 'https://public.api.bsky.app/**', match: matchBlueskyApi },
  { name: 'Bluesky CDN', pattern: 'https://cdn.bsky.app/**', match: matchBlueskyCdn },
  {
    name: 'Star History API',
    pattern: 'https://api.star-history.com/**',
    match: matchStarHistoryApi,
  },
]

/**
 * Try to match a URL against all known API routes and return a mock response.
 *
 * @param {string} url - The full request URL
 * @returns {{ name: string; response: MockResponse } | null}
 */
function matchRoute(url) {
  for (const route of routes) {
    if (urlMatchesPattern(url, route.pattern)) {
      const response = route.match(url)
      if (response) {
        return { name: route.name, response }
      }
      // URL matches the domain pattern but handler returned null => unmocked
      return null
    }
  }
  return null
}

/**
 * Check if a URL matches a simple glob pattern like "https://example.com/**".
 *
 * @param {string} url
 * @param {string} pattern
 * @returns {boolean}
 */
function urlMatchesPattern(url, pattern) {
  // Convert "https://example.com/**" to a prefix check
  if (pattern.endsWith('/**')) {
    const prefix = pattern.slice(0, -2)
    return url.startsWith(prefix)
  }
  return url === pattern
}

/**
 * Check if a URL belongs to any of the known external API domains.
 *
 * @param {string} url
 * @returns {string | null} The API name if matched, null otherwise
 */
function getExternalApiName(url) {
  for (const route of routes) {
    if (urlMatchesPattern(url, route.pattern)) {
      return route.name
    }
  }
  return null
}

// Helper to build a JSON MockResponse
function json(data, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  }
}

module.exports = {
  routes,
  matchRoute,
  getExternalApiName,
  readFixture,
  parseScopedPackage,
  packageToFixturePath,
}
