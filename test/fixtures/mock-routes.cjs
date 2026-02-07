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
  const rangeMatch = pathname.match(/^\/downloads\/range\/[^/]+\/(.+)$/)
  if (rangeMatch && rangeMatch[1]) {
    const packageName = rangeMatch[1]
    return json({ downloads: [], start: '2025-01-01', end: '2025-01-31', package: packageName })
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
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchFastNpmMeta(urlString) {
  const url = new URL(urlString)
  let packageName = decodeURIComponent(url.pathname.slice(1))

  if (!packageName) return null

  let specifier = 'latest'
  if (packageName.startsWith('@')) {
    const atIndex = packageName.indexOf('@', 1)
    if (atIndex !== -1) {
      specifier = packageName.slice(atIndex + 1)
      packageName = packageName.slice(0, atIndex)
    }
  } else {
    const atIndex = packageName.indexOf('@')
    if (atIndex !== -1) {
      specifier = packageName.slice(atIndex + 1)
      packageName = packageName.slice(0, atIndex)
    }
  }

  const packument = readFixture(packageToFixturePath(packageName))
  if (!packument) return null

  const distTags = packument['dist-tags']
  const versions = packument.versions
  const time = packument.time

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

  if (!version) return null

  return json({
    name: packageName,
    specifier,
    version,
    publishedAt: (time && time[version]) || new Date().toISOString(),
    lastSynced: Date.now(),
  })
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
 * @param {string} urlString
 * @returns {MockResponse | null}
 */
function matchNpmsApi(urlString) {
  const url = new URL(urlString)
  const pathname = decodeURIComponent(url.pathname)

  const packageMatch = pathname.match(/^\/v2\/package\/(.+)$/)
  if (packageMatch && packageMatch[1]) {
    const packageName = packageMatch[1]
    return json({
      analyzedAt: new Date().toISOString(),
      collected: {
        metadata: { name: packageName },
      },
      score: {
        final: 0.75,
        detail: {
          quality: 0.8,
          popularity: 0.7,
          maintenance: 0.75,
        },
      },
    })
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
function matchGitHubApi(urlString) {
  const url = new URL(urlString)
  const pathname = url.pathname

  const contributorsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contributors$/)
  if (contributorsMatch) {
    const fixture = readFixture('github/contributors.json')
    return json(fixture || [])
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
  { name: 'npms.io API', pattern: 'https://api.npms.io/**', match: matchNpmsApi },
  { name: 'jsdelivr CDN', pattern: 'https://cdn.jsdelivr.net/**', match: matchJsdelivrCdn },
  {
    name: 'jsdelivr Data API',
    pattern: 'https://data.jsdelivr.com/**',
    match: matchJsdelivrDataApi,
  },
  { name: 'Gravatar API', pattern: 'https://www.gravatar.com/**', match: matchGravatarApi },
  { name: 'GitHub API', pattern: 'https://api.github.com/**', match: matchGitHubApi },
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
