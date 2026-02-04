import type { CachedFetchResult } from '#shared/utils/fetch-cache-config'
import { createFetch } from 'ofetch'

/**
 * Test fixtures plugin for CI environments.
 *
 * This plugin intercepts all cachedFetch calls and serves pre-recorded fixture data
 * instead of hitting the real npm API.
 *
 * This ensures:
 * - Tests are deterministic and don't depend on external API availability
 * - We don't hammer the npm registry during CI runs
 * - Tests run faster with no network latency
 *
 * Set NUXT_TEST_FIXTURES_VERBOSE=true for detailed logging.
 */

const VERBOSE = process.env.NUXT_TEST_FIXTURES_VERBOSE === 'true'

const FIXTURE_PATHS = {
  packument: 'npm-registry:packuments',
  search: 'npm-registry:search',
  org: 'npm-registry:orgs',
  downloads: 'npm-api:downloads',
  user: 'users',
  esmHeaders: 'esm-sh:headers',
  esmTypes: 'esm-sh:types',
  githubContributors: 'github:contributors.json',
} as const

type FixtureType = keyof typeof FIXTURE_PATHS

interface FixtureMatch {
  type: FixtureType
  name: string
}

interface MockResult {
  data: unknown
}

function getFixturePath(type: FixtureType, name: string): string {
  const dir = FIXTURE_PATHS[type]
  let filename: string

  switch (type) {
    case 'packument':
    case 'downloads':
      filename = `${name}.json`
      break
    case 'search':
      filename = `${name.replace(/:/g, '-')}.json`
      break
    case 'org':
    case 'user':
      filename = `${name}.json`
      break
    default:
      filename = `${name}.json`
  }

  return `${dir}:${filename.replace(/\//g, ':')}`
}

/**
 * Parse a scoped package name with optional version.
 * Handles formats like: @scope/name, @scope/name@version, name, name@version
 */
function parseScopedPackageWithVersion(input: string): { name: string; version?: string } {
  if (input.startsWith('@')) {
    // Scoped package: @scope/name or @scope/name@version
    const slashIndex = input.indexOf('/')
    if (slashIndex === -1) {
      // Invalid format like just "@scope"
      return { name: input }
    }
    const afterSlash = input.slice(slashIndex + 1)
    const atIndex = afterSlash.indexOf('@')
    if (atIndex === -1) {
      // @scope/name (no version)
      return { name: input }
    }
    // @scope/name@version
    return {
      name: input.slice(0, slashIndex + 1 + atIndex),
      version: afterSlash.slice(atIndex + 1),
    }
  }

  // Unscoped package: name or name@version
  const atIndex = input.indexOf('@')
  if (atIndex === -1) {
    return { name: input }
  }
  return {
    name: input.slice(0, atIndex),
    version: input.slice(atIndex + 1),
  }
}

function getMockForUrl(url: string): MockResult | null {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return null
  }

  const { host, pathname, searchParams } = urlObj

  // OSV API - return empty vulnerability results
  if (host === 'api.osv.dev') {
    if (pathname === '/v1/querybatch') {
      return { data: { results: [] } }
    }
    if (pathname.startsWith('/v1/query')) {
      return { data: { vulns: [] } }
    }
  }

  // JSR registry - return null (npm packages aren't on JSR)
  if (host === 'jsr.io' && pathname.endsWith('/meta.json')) {
    return { data: null }
  }

  // Bundlephobia API - return mock size data
  if (host === 'bundlephobia.com' && pathname === '/api/size') {
    const packageSpec = searchParams.get('package')
    if (packageSpec) {
      return {
        data: {
          name: packageSpec.split('@')[0],
          size: 12345,
          gzip: 4567,
          dependencyCount: 3,
        },
      }
    }
  }

  // npms.io API - return mock package score data
  if (host === 'api.npms.io') {
    const packageMatch = decodeURIComponent(pathname).match(/^\/v2\/package\/(.+)$/)
    if (packageMatch?.[1]) {
      return {
        data: {
          analyzedAt: new Date().toISOString(),
          collected: {
            metadata: { name: packageMatch[1] },
          },
          score: {
            final: 0.75,
            detail: {
              quality: 0.8,
              popularity: 0.7,
              maintenance: 0.75,
            },
          },
        },
      }
    }
  }

  // jsdelivr CDN - return 404 for README files, etc.
  if (host === 'cdn.jsdelivr.net') {
    // Return null data which will cause a 404 - README files are optional
    return { data: null }
  }

  // jsdelivr data API - return mock file listing
  if (host === 'data.jsdelivr.com') {
    const packageMatch = decodeURIComponent(pathname).match(/^\/v1\/packages\/npm\/(.+)$/)
    if (packageMatch?.[1]) {
      const pkgWithVersion = packageMatch[1]
      const parsed = parseScopedPackageWithVersion(pkgWithVersion)
      return {
        data: {
          type: 'npm',
          name: parsed.name,
          version: parsed.version || 'latest',
          files: [
            { name: 'package.json', hash: 'abc123', size: 1000 },
            { name: 'index.js', hash: 'def456', size: 500 },
            { name: 'README.md', hash: 'ghi789', size: 2000 },
          ],
        },
      }
    }
  }

  // Gravatar API - return 404 (avatars not needed in tests)
  if (host === 'www.gravatar.com') {
    return { data: null }
  }

  // GitHub API - handled via fixtures, return null to use fixture system
  // Note: The actual fixture loading is handled in fetchFromFixtures via special case
  if (host === 'api.github.com') {
    // Return null here so it goes through fetchFromFixtures which handles the fixture loading
    return null
  }

  // esm.sh is handled specially via $fetch.raw override, not here
  // Return null to indicate no mock available at the cachedFetch level

  return null
}

/**
 * Process a single package query for fast-npm-meta.
 * Returns the metadata for a single package or null/error result.
 */
async function processSingleFastNpmMeta(
  packageQuery: string,
  storage: ReturnType<typeof useStorage>,
  metadata: boolean,
): Promise<Record<string, unknown>> {
  let packageName = packageQuery
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

  // Special case: packages with "does-not-exist" in the name should 404
  if (packageName.includes('does-not-exist') || packageName.includes('nonexistent')) {
    return { error: 'not_found' }
  }

  const fixturePath = getFixturePath('packument', packageName)
  const packument = await storage.getItem<any>(fixturePath)

  if (!packument) {
    // For unknown packages without the special markers, try to return stub data
    // This is handled elsewhere - returning error here for fast-npm-meta
    return { error: 'not_found' }
  }

  let version: string | undefined
  if (specifier === 'latest' || !specifier) {
    version = packument['dist-tags']?.latest
  } else if (packument['dist-tags']?.[specifier]) {
    version = packument['dist-tags'][specifier]
  } else if (packument.versions?.[specifier]) {
    version = specifier
  } else {
    version = packument['dist-tags']?.latest
  }

  if (!version) {
    return { error: 'version_not_found' }
  }

  const result: Record<string, unknown> = {
    name: packageName,
    specifier,
    version,
    publishedAt: packument.time?.[version] || new Date().toISOString(),
    lastSynced: Date.now(),
  }

  // Include metadata if requested
  if (metadata) {
    const versionData = packument.versions?.[version]
    if (versionData?.deprecated) {
      result.deprecated = versionData.deprecated
    }
  }

  return result
}

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

  const { host, pathname, searchParams } = urlObj

  if (host !== 'npm.antfu.dev') return null

  const pathPart = decodeURIComponent(pathname.slice(1))
  if (!pathPart) return null

  const metadata = searchParams.get('metadata') === 'true'

  // Handle batch requests (package1+package2+...)
  if (pathPart.includes('+')) {
    const packages = pathPart.split('+')
    const results = await Promise.all(
      packages.map(pkg => processSingleFastNpmMeta(pkg, storage, metadata)),
    )
    return { data: results }
  }

  // Handle single package request
  const result = await processSingleFastNpmMeta(pathPart, storage, metadata)
  if ('error' in result) {
    return { data: null }
  }
  return { data: result }
}

/**
 * Handle GitHub API requests using fixtures.
 */
async function handleGitHubApi(
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

  if (host !== 'api.github.com') return null

  // Contributors endpoint: /repos/{owner}/{repo}/contributors
  const contributorsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contributors$/)
  if (contributorsMatch) {
    const contributors = await storage.getItem<unknown[]>(FIXTURE_PATHS.githubContributors)
    if (contributors) {
      return { data: contributors }
    }
    // Return empty array if no fixture exists
    return { data: [] }
  }

  // Other GitHub API endpoints can be added here as needed
  return null
}

interface FixtureMatchWithVersion extends FixtureMatch {
  version?: string // 'latest', a semver version, or undefined for full packument
}

function matchUrlToFixture(url: string): FixtureMatchWithVersion | null {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return null
  }

  const { host, pathname, searchParams } = urlObj

  // npm registry (registry.npmjs.org)
  if (host === 'registry.npmjs.org') {
    // Search endpoint
    if (pathname === '/-/v1/search') {
      const query = searchParams.get('text')
      if (query) {
        const maintainerMatch = query.match(/^maintainer:(.+)$/)
        if (maintainerMatch?.[1]) {
          return { type: 'user', name: maintainerMatch[1] }
        }
        return { type: 'search', name: query }
      }
      return { type: 'search', name: '' }
    }

    // Org packages
    const orgMatch = pathname.match(/^\/-\/org\/([^/]+)\/package$/)
    if (orgMatch?.[1]) {
      return { type: 'org', name: orgMatch[1] }
    }

    // Packument - handle both full packument and version manifest requests
    let packagePath = decodeURIComponent(pathname.slice(1))
    if (packagePath && !packagePath.startsWith('-/')) {
      let version: string | undefined

      if (packagePath.startsWith('@')) {
        const parts = packagePath.split('/')
        if (parts.length > 2) {
          // @scope/name/version or @scope/name/latest
          version = parts[2]
          packagePath = `${parts[0]}/${parts[1]}`
        }
        // else just @scope/name - full packument
      } else {
        const slashIndex = packagePath.indexOf('/')
        if (slashIndex !== -1) {
          // name/version or name/latest
          version = packagePath.slice(slashIndex + 1)
          packagePath = packagePath.slice(0, slashIndex)
        }
        // else just name - full packument
      }

      return { type: 'packument', name: packagePath, version }
    }
  }

  // npm API (api.npmjs.org)
  if (host === 'api.npmjs.org') {
    const downloadsMatch = pathname.match(/^\/downloads\/point\/[^/]+\/(.+)$/)
    if (downloadsMatch?.[1]) {
      return { type: 'downloads', name: decodeURIComponent(downloadsMatch[1]) }
    }
  }

  return null
}

/**
 * Log a message to stderr with clear formatting for unmocked requests.
 */
function logUnmockedRequest(type: string, detail: string, url: string): void {
  process.stderr.write(
    `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `[test-fixtures] ${type}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `${detail}\n` +
      `URL: ${url}\n` +
      `\n` +
      `To fix: Add a fixture file or update test/e2e/test-utils.ts\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
  )
}

/**
 * Shared fixture-backed fetch implementation.
 * This is used by both cachedFetch and the global $fetch override.
 */
async function fetchFromFixtures<T>(
  url: string,
  storage: ReturnType<typeof useStorage>,
): Promise<CachedFetchResult<T>> {
  // Check for mock responses (OSV, JSR)
  const mockResult = getMockForUrl(url)
  if (mockResult) {
    if (VERBOSE) process.stdout.write(`[test-fixtures] Mock: ${url}\n`)
    return { data: mockResult.data as T, isStale: false, cachedAt: Date.now() }
  }

  // Check for fast-npm-meta
  const fastNpmMetaResult = await handleFastNpmMeta(url, storage)
  if (fastNpmMetaResult) {
    if (VERBOSE) process.stdout.write(`[test-fixtures] Fast-npm-meta: ${url}\n`)
    return { data: fastNpmMetaResult.data as T, isStale: false, cachedAt: Date.now() }
  }

  // Check for GitHub API
  const githubResult = await handleGitHubApi(url, storage)
  if (githubResult) {
    if (VERBOSE) process.stdout.write(`[test-fixtures] GitHub API: ${url}\n`)
    return { data: githubResult.data as T, isStale: false, cachedAt: Date.now() }
  }

  const match = matchUrlToFixture(url)

  if (!match) {
    logUnmockedRequest('NO FIXTURE PATTERN', 'URL does not match any known fixture pattern', url)
    throw createError({
      statusCode: 404,
      statusMessage: 'No test fixture available',
      message: `No fixture pattern matches URL: ${url}`,
    })
  }

  const fixturePath = getFixturePath(match.type, match.name)
  const rawData = await storage.getItem<any>(fixturePath)

  if (rawData === null) {
    // For user searches or search queries without fixtures, return empty results
    if (match.type === 'user' || match.type === 'search') {
      if (VERBOSE) process.stdout.write(`[test-fixtures] Empty ${match.type}: ${match.name}\n`)
      return {
        data: { objects: [], total: 0, time: new Date().toISOString() } as T,
        isStale: false,
        cachedAt: Date.now(),
      }
    }

    // For org packages without fixtures, return 404
    if (match.type === 'org') {
      throw createError({
        statusCode: 404,
        statusMessage: 'Org not found',
        message: `No fixture for org: ${match.name}`,
      })
    }

    // For packuments without fixtures, return a stub packument
    // This allows tests to work without needing fixtures for every dependency
    if (match.type === 'packument') {
      // Special case: packages with "does-not-exist" in the name should 404
      // This allows tests to verify 404 behavior for nonexistent packages
      if (match.name.includes('does-not-exist') || match.name.includes('nonexistent')) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Package not found',
          message: `Package ${match.name} does not exist`,
        })
      }

      if (VERBOSE) process.stderr.write(`[test-fixtures] Stub packument: ${match.name}\n`)
      const stubVersion = '1.0.0'
      const stubPackument = {
        'name': match.name,
        'dist-tags': { latest: stubVersion },
        'versions': {
          [stubVersion]: {
            name: match.name,
            version: stubVersion,
            description: `Stub fixture for ${match.name}`,
            dependencies: {},
          },
        },
        'time': {
          created: new Date().toISOString(),
          modified: new Date().toISOString(),
          [stubVersion]: new Date().toISOString(),
        },
        'maintainers': [],
      }

      // If a specific version was requested, return just that version manifest
      if (match.version) {
        return {
          data: stubPackument.versions[stubVersion] as T,
          isStale: false,
          cachedAt: Date.now(),
        }
      }

      return {
        data: stubPackument as T,
        isStale: false,
        cachedAt: Date.now(),
      }
    }

    // For downloads without fixtures, return zero downloads
    if (match.type === 'downloads') {
      if (VERBOSE) process.stderr.write(`[test-fixtures] Stub downloads: ${match.name}\n`)
      return {
        data: {
          downloads: 0,
          start: '2025-01-01',
          end: '2025-01-31',
          package: match.name,
        } as T,
        isStale: false,
        cachedAt: Date.now(),
      }
    }

    // Log missing fixture for unknown types
    if (VERBOSE) {
      process.stderr.write(`[test-fixtures] Missing: ${fixturePath}\n`)
    }

    throw createError({
      statusCode: 404,
      statusMessage: 'Not found',
      message: `No fixture for ${match.type}: ${match.name}`,
    })
  }

  // Handle version-specific requests for packuments (e.g., /create-vite/latest)
  let data: T = rawData
  if (match.type === 'packument' && match.version) {
    const packument = rawData as any
    let resolvedVersion = match.version

    // Resolve 'latest' or dist-tags to actual version
    if (packument['dist-tags']?.[resolvedVersion]) {
      resolvedVersion = packument['dist-tags'][resolvedVersion]
    }

    // Return the version manifest instead of full packument
    const versionData = packument.versions?.[resolvedVersion]
    if (versionData) {
      data = versionData as T
      if (VERBOSE)
        process.stdout.write(
          `[test-fixtures] Served: ${match.type}/${match.name}@${resolvedVersion}\n`,
        )
    } else {
      if (VERBOSE)
        process.stderr.write(
          `[test-fixtures] Version not found: ${match.name}@${resolvedVersion}\n`,
        )
      throw createError({
        statusCode: 404,
        statusMessage: 'Version not found',
        message: `No version ${resolvedVersion} in fixture for ${match.name}`,
      })
    }
  } else {
    if (VERBOSE) process.stdout.write(`[test-fixtures] Served: ${match.type}/${match.name}\n`)
  }

  return { data, isStale: false, cachedAt: Date.now() }
}

/**
 * Handle native fetch for esm.sh URLs.
 */
async function handleEsmShFetch(
  urlStr: string,
  init: RequestInit | undefined,
  storage: ReturnType<typeof useStorage>,
): Promise<Response> {
  const method = init?.method?.toUpperCase() || 'GET'
  const urlObj = new URL(urlStr)
  const pathname = urlObj.pathname.slice(1) // Remove leading /

  // HEAD request - return headers with x-typescript-types if fixture exists
  if (method === 'HEAD') {
    // Extract package@version from pathname
    let pkgVersion = pathname
    const slashIndex = pkgVersion.indexOf(
      '/',
      pkgVersion.includes('@') ? pkgVersion.lastIndexOf('@') + 1 : 0,
    )
    if (slashIndex !== -1) {
      pkgVersion = pkgVersion.slice(0, slashIndex)
    }

    const fixturePath = `${FIXTURE_PATHS.esmHeaders}:${pkgVersion.replace(/\//g, ':')}.json`
    const headerData = await storage.getItem<{ 'x-typescript-types': string }>(fixturePath)

    if (headerData) {
      if (VERBOSE) process.stdout.write(`[test-fixtures] fetch HEAD esm.sh: ${pkgVersion}\n`)
      return new Response(null, {
        status: 200,
        headers: {
          'x-typescript-types': headerData['x-typescript-types'],
          'content-type': 'application/javascript',
        },
      })
    }

    // No fixture - return 200 without x-typescript-types header (types not available)
    if (VERBOSE)
      process.stdout.write(`[test-fixtures] fetch HEAD esm.sh (no fixture): ${pkgVersion}\n`)
    return new Response(null, {
      status: 200,
      headers: { 'content-type': 'application/javascript' },
    })
  }

  // GET request - return .d.ts content if fixture exists
  if (method === 'GET' && pathname.endsWith('.d.ts')) {
    const fixturePath = `${FIXTURE_PATHS.esmTypes}:${pathname.replace(/\//g, ':')}`
    const content = await storage.getItem<string>(fixturePath)

    if (content) {
      if (VERBOSE) process.stdout.write(`[test-fixtures] fetch GET esm.sh: ${pathname}\n`)
      return new Response(content, {
        status: 200,
        headers: { 'content-type': 'application/typescript' },
      })
    }

    // Return a minimal stub .d.ts file instead of 404
    // This allows docs tests to work without real type definition fixtures
    if (VERBOSE)
      process.stdout.write(`[test-fixtures] fetch GET esm.sh (stub types): ${pathname}\n`)
    const stubTypes = `// Stub types for ${pathname}
export declare function stubFunction(): void;
export declare const stubConstant: string;
export type StubType = string | number;
export interface StubInterface {
  value: string;
}
`
    return new Response(stubTypes, {
      status: 200,
      headers: { 'content-type': 'application/typescript' },
    })
  }

  // Other esm.sh requests - return empty response
  return new Response(null, { status: 200 })
}

export default defineNitroPlugin(nitroApp => {
  const storage = useStorage('fixtures')

  if (VERBOSE) {
    process.stdout.write('[test-fixtures] Test mode active (verbose logging enabled)\n')
  }

  const originalFetch = globalThis.fetch
  const original$fetch = globalThis.$fetch

  // Override native fetch for esm.sh requests
  globalThis.fetch = async (input: URL | RequestInfo, init?: RequestInit): Promise<Response> => {
    const urlStr =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url

    if (urlStr.startsWith('/') || urlStr.includes('woff') || urlStr.includes('fonts')) {
      return await originalFetch(input, init)
    }

    if (urlStr.startsWith('https://esm.sh/')) {
      return await handleEsmShFetch(urlStr, init, storage)
    }

    try {
      const res = await fetchFromFixtures(urlStr, storage)
      if (res.data) {
        return new Response(JSON.stringify(res.data), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response('Not Found', { status: 404 })
    } catch (err: any) {
      // Convert createError exceptions to proper HTTP responses
      const statusCode = err?.statusCode || err?.status || 404
      const message = err?.message || 'Not Found'
      return new Response(JSON.stringify({ error: message }), {
        status: statusCode,
        headers: { 'content-type': 'application/json' },
      })
    }
  }

  const $fetch = createFetch({
    fetch: globalThis.fetch,
  })

  // Create the wrapper function for globalThis.$fetch
  const fetchWrapper = async <T = unknown>(
    url: string,
    options?: Parameters<typeof $fetch>[1],
  ): Promise<T> => {
    if (typeof url === 'string' && !url.startsWith('/')) {
      return $fetch<T>(url, options as any)
    }
    return original$fetch<T>(url, options as any) as any
  }

  // Copy .raw and .create from the created $fetch instance to the wrapper
  Object.assign(fetchWrapper, {
    raw: $fetch.raw,
    create: $fetch.create,
  })

  // Replace globalThis.$fetch with our wrapper (must be done AFTER setting .raw/.create)
  // @ts-expect-error - wrapper function types don't fully match Nitro's $fetch types
  globalThis.$fetch = fetchWrapper

  // Per-request: set up cachedFetch on the event context
  nitroApp.hooks.hook('request', event => {
    event.context.cachedFetch = async (url: string, options?: any) => {
      return {
        data: await globalThis.$fetch(url, options),
        isStale: false,
        cachedAt: null,
      }
    }
  })
})
