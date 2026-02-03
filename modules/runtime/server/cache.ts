import type { CachedFetchResult } from '#shared/utils/fetch-cache-config'
import { join } from 'node:path'

/**
 * Test fixtures plugin for CI environments.
 *
 * This plugin intercepts all cachedFetch calls
 * and serves pre-recorded fixture data instead of hitting the real npm API.
 *
 * This ensures:
 * - Tests are deterministic and don't depend on external API availability
 * - We don't hammer the npm registry during CI runs
 * - Tests run faster with no network latency
 *
 * For URLs without fixtures, a 404 error is thrown to fail fast.
 */

/**
 * Fixture types mapped to their directory structure
 */
const FIXTURE_PATHS = {
  packument: 'npm-registry/packuments',
  search: 'npm-registry/search',
  org: 'npm-registry/orgs',
  downloads: 'npm-api/downloads',
  user: 'users',
} as const

type FixtureType = keyof typeof FIXTURE_PATHS

interface FixtureMatch {
  type: FixtureType
  name: string
}

/**
 * Normalize a package name for use as a filename.
 */
function packageNameToFilename(packageName: string): string {
  return `${packageName}.json`
}

/**
 * Normalize a search query for use as a filename.
 */
function searchQueryToFilename(query: string): string {
  return `${query.replace(/:/g, '-')}.json`
}

/**
 * Get the path to a fixture file.
 */
function getFixturePath(type: FixtureType, name: string): string {
  const dir = FIXTURE_PATHS[type]
  let filename: string

  switch (type) {
    case 'packument':
    case 'downloads':
      filename = packageNameToFilename(name)
      break
    case 'search':
      filename = searchQueryToFilename(name)
      break
    case 'org':
    case 'user':
      filename = `${name}.json`
      break
    default:
      filename = `${name}.json`
  }

  return join(dir, filename).replace(/\//g, ':')
}

/**
 * Special API handlers that return mock data without needing fixtures
 */
interface MockResult {
  data: unknown
}

function getMockForUrl(url: string): MockResult | null {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return null
  }

  const { host, pathname } = urlObj

  // OSV API (api.osv.dev) - return empty results for vulnerability checks
  if (host === 'api.osv.dev') {
    // For batch queries, return empty results
    if (pathname === '/v1/querybatch') {
      return { data: { results: [] } }
    }
    // For single package queries
    if (pathname.startsWith('/v1/query')) {
      return { data: { vulns: [] } }
    }
  }

  // JSR registry (jsr.io) - return null for most packages (they're npm packages)
  if (host === 'jsr.io') {
    // For meta.json requests, return null to indicate package not on JSR
    if (pathname.endsWith('/meta.json')) {
      return { data: null }
    }
  }

  return null
}

/**
 * Handle npm.antfu.dev (fast-npm-meta) requests by extracting version from packument fixture
 */
async function handleFastNpmMeta(
  url: string,
  storage: ReturnType<typeof useStorage>,
): Promise<MockResult | null> {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return null
  }

  const { host, pathname } = urlObj

  // npm.antfu.dev returns version info for packages
  if (host === 'npm.antfu.dev') {
    // Parse package name from pathname (e.g., /vue, /@nuxt/kit, /vue@3.4.0, /@nuxt/kit@3.0.0)
    let packageName = decodeURIComponent(pathname.slice(1))
    if (!packageName) return null

    // Handle version specifier with @ syntax (e.g., vue@3.4.0, @nuxt/kit@3.0.0)
    let specifier = 'latest'

    if (packageName.startsWith('@')) {
      // Scoped package: @scope/name or @scope/name@version
      // Split on @ but keep the first @ (scope)
      const atIndex = packageName.indexOf('@', 1) // Find @ after scope
      if (atIndex !== -1) {
        specifier = packageName.slice(atIndex + 1)
        packageName = packageName.slice(0, atIndex)
      }
    } else {
      // Unscoped package: name or name@version
      const atIndex = packageName.indexOf('@')
      if (atIndex !== -1) {
        specifier = packageName.slice(atIndex + 1)
        packageName = packageName.slice(0, atIndex)
      }
    }

    // Get packument from fixture
    const fixturePath = getFixturePath('packument', packageName)
    const packument = await storage.getItem<any>(fixturePath)

    if (!packument) {
      // Return 404-like response for unknown packages
      return null
    }

    // Resolve the version
    let version: string | undefined
    if (specifier === 'latest' || !specifier) {
      version = packument['dist-tags']?.latest
    } else if (packument['dist-tags']?.[specifier]) {
      // It's a tag like 'beta', 'alpha', etc.
      version = packument['dist-tags'][specifier]
    } else if (packument.versions?.[specifier]) {
      // It's a specific version
      version = specifier
    } else {
      // Try to find matching version with semver
      version = packument['dist-tags']?.latest
    }

    if (!version) {
      return null
    }

    // Get the publish time from the packument's time field
    const publishedAt = packument.time?.[version] || new Date().toISOString()

    return {
      data: {
        name: packageName,
        specifier,
        version,
        publishedAt,
        lastSynced: Date.now(),
      },
    }
  }

  return null
}

/**
 * Parse a URL and determine which fixture it should map to.
 */
function matchUrlToFixture(url: string): FixtureMatch | null {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return null
  }

  const { host, pathname, searchParams } = urlObj

  // npm registry (registry.npmjs.org)
  if (host === 'registry.npmjs.org') {
    // Search: /-/v1/search?text=query
    if (pathname === '/-/v1/search') {
      const query = searchParams.get('text')
      if (query) {
        // Check if it's a maintainer search (user profile page)
        const maintainerMatch = query.match(/^maintainer:(.+)$/)
        if (maintainerMatch?.[1]) {
          return { type: 'user', name: maintainerMatch[1] }
        }
        return { type: 'search', name: query }
      }
    }

    // Org packages: /-/org/{orgname}/package
    const orgMatch = pathname.match(/^\/-\/org\/([^/]+)\/package$/)
    if (orgMatch?.[1]) {
      return { type: 'org', name: orgMatch[1] }
    }

    // User packages (maintainer search): /-/v1/search?text=maintainer:username
    // This is already handled by the search case above

    // Packument: /{package} or /@{scope}%2F{name} or /{package}/{version}
    // Remove leading slash and decode
    let packagePath = decodeURIComponent(pathname.slice(1))
    if (packagePath && !packagePath.startsWith('-/')) {
      // Strip version tag if present (e.g., vue/latest -> vue, @nuxt/kit/3.0.0 -> @nuxt/kit)
      // Scoped packages: @scope/name or @scope/name/version
      // Unscoped packages: name or name/version
      if (packagePath.startsWith('@')) {
        // Scoped: @scope/name/version -> @scope/name
        const parts = packagePath.split('/')
        if (parts.length > 2) {
          packagePath = `${parts[0]}/${parts[1]}`
        }
      } else {
        // Unscoped: name/version -> name
        const slashIndex = packagePath.indexOf('/')
        if (slashIndex !== -1) {
          packagePath = packagePath.slice(0, slashIndex)
        }
      }
      return { type: 'packument', name: packagePath }
    }
  }

  // npm API (api.npmjs.org)
  if (host === 'api.npmjs.org') {
    // Downloads: /downloads/point/{period}/{package}
    const downloadsMatch = pathname.match(/^\/downloads\/point\/[^/]+\/(.+)$/)
    if (downloadsMatch?.[1]) {
      const packageName = decodeURIComponent(downloadsMatch[1])
      return { type: 'downloads', name: packageName }
    }
  }

  return null
}

export default defineNitroPlugin(nitroApp => {
  const storage = useStorage('fixtures')

  process.stdout.write('[test-fixtures] Test mode active - serving fixtures instead of real API\n')

  nitroApp.hooks.hook('request', event => {
    // Create a fixture-serving cachedFetch that replaces the real one
    event.context.cachedFetch = async <T = unknown>(
      url: string,
      _options?: Parameters<typeof $fetch>[1],
      _ttl?: number,
    ): Promise<CachedFetchResult<T>> => {
      // First check if this URL has a mock response
      const mockResult = getMockForUrl(url)
      if (mockResult) {
        process.stdout.write(`[test-fixtures] Serving mock response for: ${url}\n`)
        return {
          data: mockResult.data as T,
          isStale: false,
          cachedAt: Date.now(),
        }
      }

      // Check for fast-npm-meta (npm.antfu.dev) - derives response from packument fixture
      const fastNpmMetaResult = await handleFastNpmMeta(url, storage)
      if (fastNpmMetaResult) {
        process.stdout.write(`[test-fixtures] Serving fast-npm-meta response for: ${url}\n`)
        return {
          data: fastNpmMetaResult.data as T,
          isStale: false,
          cachedAt: Date.now(),
        }
      }

      const match = matchUrlToFixture(url)

      if (!match) {
        // URL doesn't match any known fixture pattern
        // For unknown patterns, throw an error to fail fast
        // Use process.stderr.write to avoid Node's util.inspect issues with h3 errors
        process.stderr.write(`[test-fixtures] No fixture pattern for URL: ${url}\n`)
        throw createError({
          statusCode: 404,
          statusMessage: 'No test fixture available',
          message: `[test-fixtures] No fixture pattern matches URL: ${url}`,
        })
      }

      const fixturePath = getFixturePath(match.type, match.name)
      const data = await storage.getItem<T>(fixturePath)

      if (data === null) {
        // Fixture file doesn't exist
        // Use process.stderr.write to avoid Node's util.inspect issues with h3 errors
        process.stderr.write(
          `[test-fixtures] Fixture not found: ${fixturePath} (for ${match.type}: ${match.name})\n`,
        )

        // For user fixtures (maintainer searches), return empty result instead of 404
        // This simulates a user with no packages, which is valid behavior
        if (match.type === 'user') {
          process.stdout.write(
            `[test-fixtures] Returning empty search result for unknown user: ${match.name}\n`,
          )
          return {
            data: {
              objects: [],
              total: 0,
              time: new Date().toISOString(),
            } as T,
            isStale: false,
            cachedAt: Date.now(),
          }
        }

        const err = createError({
          statusCode: 404,
          statusMessage: 'Package not found',
          message: `[test-fixtures] No fixture for ${match.type}: ${match.name}. Expected at: ${fixturePath}`,
        })
        throw err
      }

      process.stdout.write(`[test-fixtures] Serving fixture: ${match.type}/${match.name}\n`)

      return {
        data,
        isStale: false,
        cachedAt: Date.now(),
      }
    }

    const originalFetch = globalThis.$fetch

    // @ts-expect-error invalid global augmentation
    globalThis.$fetch = async (url, options) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        return originalFetch(url, options)
      }
      const { data } = await event.context.cachedFetch!<any>(url as string, options)
      return data
    }
  })
})
