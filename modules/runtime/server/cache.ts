import type { CachedFetchResult } from '#shared/utils/fetch-cache-config'

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

function getMockForUrl(url: string): MockResult | null {
  let urlObj: URL
  try {
    urlObj = new URL(url)
  } catch {
    return null
  }

  const { host, pathname } = urlObj

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

  // esm.sh is handled specially via $fetch.raw override, not here
  // Return null to indicate no mock available at the cachedFetch level

  return null
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

  const { host, pathname } = urlObj

  if (host !== 'npm.antfu.dev') return null

  let packageName = decodeURIComponent(pathname.slice(1))
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

  const fixturePath = getFixturePath('packument', packageName)
  const packument = await storage.getItem<any>(fixturePath)

  if (!packument) {
    return { data: null }
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

  if (!version) return null

  return {
    data: {
      name: packageName,
      specifier,
      version,
      publishedAt: packument.time?.[version] || new Date().toISOString(),
      lastSynced: Date.now(),
    },
  }
}

/**
 * Handle esm.sh requests for the standard $fetch (returns data directly).
 */
async function handleEsmShRequest(
  url: string,
  _options: unknown,
  storage: ReturnType<typeof useStorage>,
): Promise<unknown | null> {
  const urlObj = new URL(url)
  if (urlObj.hostname !== 'esm.sh') return null

  // For GET requests to .d.ts files, return the file content
  const typesPath = urlObj.pathname.slice(1) // Remove leading /
  if (typesPath.endsWith('.d.ts')) {
    const fixturePath = `${FIXTURE_PATHS.esmTypes}:${typesPath.replace(/\//g, ':')}`
    const content = await storage.getItem<string>(fixturePath)
    if (content) {
      if (VERBOSE) process.stdout.write(`[test-fixtures] esm.sh types: ${typesPath}\n`)
      return content
    }
  }

  return null
}

/**
 * Handle esm.sh requests for $fetch.raw (returns response object with headers).
 */
async function handleEsmShRawRequest(
  url: string,
  options: unknown,
  storage: ReturnType<typeof useStorage>,
): Promise<unknown | null> {
  const urlObj = new URL(url)
  if (urlObj.hostname !== 'esm.sh') return null

  const pathname = urlObj.pathname.slice(1) // Remove leading /
  const opts = options as { method?: string } | undefined

  // HEAD request - return headers with x-typescript-types
  if (opts?.method === 'HEAD') {
    // Extract package@version from pathname (e.g., "ufo@1.6.3" or "@scope/pkg@1.0.0")
    let pkgVersion = pathname
    // Remove any trailing path after the version
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
      if (VERBOSE) process.stdout.write(`[test-fixtures] esm.sh HEAD: ${pkgVersion}\n`)
      // Return a mock response object similar to what $fetch.raw returns
      return {
        status: 200,
        statusText: 'OK',
        url,
        headers: new Headers({
          'x-typescript-types': headerData['x-typescript-types'],
          'content-type': 'application/javascript',
        }),
        _data: null,
      }
    }

    // No fixture - return empty response (no types available)
    if (VERBOSE) process.stdout.write(`[test-fixtures] esm.sh HEAD (no fixture): ${pkgVersion}\n`)
    return {
      status: 200,
      statusText: 'OK',
      url,
      headers: new Headers({
        'content-type': 'application/javascript',
      }),
      _data: null,
    }
  }

  // GET request - return .d.ts content
  if (pathname.endsWith('.d.ts') || pathname.includes('.d.ts')) {
    const fixturePath = `${FIXTURE_PATHS.esmTypes}:${pathname.replace(/\//g, ':')}`
    const content = await storage.getItem<string>(fixturePath)

    if (content) {
      if (VERBOSE) process.stdout.write(`[test-fixtures] esm.sh GET: ${pathname}\n`)
      // Create a blob-like response
      return {
        status: 200,
        statusText: 'OK',
        url,
        headers: new Headers({
          'content-type': 'application/typescript',
        }),
        _data: {
          text: async () => content,
        },
      }
    }
  }

  return null
}

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

    // Packument
    let packagePath = decodeURIComponent(pathname.slice(1))
    if (packagePath && !packagePath.startsWith('-/')) {
      if (packagePath.startsWith('@')) {
        const parts = packagePath.split('/')
        if (parts.length > 2) {
          packagePath = `${parts[0]}/${parts[1]}`
        }
      } else {
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

export default defineNitroPlugin(nitroApp => {
  const storage = useStorage('fixtures')

  if (VERBOSE) {
    process.stdout.write('[test-fixtures] Test mode active (verbose logging enabled)\n')
  }

  // Override native fetch globally to intercept esm.sh requests from ofetch
  // This is needed because server/utils/docs/client.ts imports $fetch from ofetch
  // directly, bypassing our globalThis.$fetch override
  const originalNativeFetch = globalThis.fetch
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    if (url.includes('esm.sh')) {
      const method = init?.method || 'GET'

      // HEAD request - return headers with x-typescript-types
      if (method === 'HEAD') {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname.slice(1)
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
            headers: new Headers({
              'x-typescript-types': headerData['x-typescript-types'],
              'content-type': 'application/javascript',
            }),
          })
        }

        // No fixture - return response without types header
        if (VERBOSE)
          process.stdout.write(`[test-fixtures] fetch HEAD esm.sh (no fixture): ${pkgVersion}\n`)
        return new Response(null, {
          status: 200,
          headers: new Headers({ 'content-type': 'application/javascript' }),
        })
      }

      // GET request for .d.ts files
      if (method === 'GET') {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname.slice(1)
        const fixturePath = `${FIXTURE_PATHS.esmTypes}:${pathname.replace(/\//g, ':')}`
        const content = await storage.getItem<string>(fixturePath)

        if (content) {
          if (VERBOSE) process.stdout.write(`[test-fixtures] fetch GET esm.sh: ${pathname}\n`)
          return new Response(content, {
            status: 200,
            headers: new Headers({ 'content-type': 'application/typescript' }),
          })
        }

        // No fixture - return 404 so the loader skips this file
        if (VERBOSE)
          process.stdout.write(`[test-fixtures] fetch GET esm.sh (no fixture): ${pathname}\n`)
        return new Response('Not Found', {
          status: 404,
          headers: new Headers({ 'content-type': 'text/plain' }),
        })
      }
    }

    return originalNativeFetch(input, init)
  }

  nitroApp.hooks.hook('request', event => {
    event.context.cachedFetch = async <T = unknown>(
      url: string,
      _options?: Parameters<typeof $fetch>[1],
      _ttl?: number,
    ): Promise<CachedFetchResult<T>> => {
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

      const match = matchUrlToFixture(url)

      if (!match) {
        logUnmockedRequest(
          'NO FIXTURE PATTERN',
          'URL does not match any known fixture pattern',
          url,
        )
        throw createError({
          statusCode: 404,
          statusMessage: 'No test fixture available',
          message: `No fixture pattern matches URL: ${url}`,
        })
      }

      const fixturePath = getFixturePath(match.type, match.name)
      const data = await storage.getItem<T>(fixturePath)

      if (data === null) {
        // For user searches or search queries without fixtures, return empty results
        if (match.type === 'user' || match.type === 'search') {
          if (VERBOSE) process.stdout.write(`[test-fixtures] Empty ${match.type}: ${match.name}\n`)
          return {
            data: { objects: [], total: 0, time: new Date().toISOString() } as T,
            isStale: false,
            cachedAt: Date.now(),
          }
        }

        // Log missing fixture (but don't spam - these are often expected for dependencies)
        if (VERBOSE) {
          process.stderr.write(`[test-fixtures] Missing: ${fixturePath}\n`)
        }

        throw createError({
          statusCode: 404,
          statusMessage: 'Package not found',
          message: `No fixture for ${match.type}: ${match.name}`,
        })
      }

      if (VERBOSE) process.stdout.write(`[test-fixtures] Served: ${match.type}/${match.name}\n`)

      return { data, isStale: false, cachedAt: Date.now() }
    }

    const originalFetch = globalThis.$fetch

    // @ts-expect-error invalid global augmentation
    globalThis.$fetch = async (url, options) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        return originalFetch(url, options)
      }

      // Handle esm.sh requests specially (used by docs feature)
      if (typeof url === 'string' && url.includes('esm.sh')) {
        const esmResult = await handleEsmShRequest(url, options, storage)
        if (esmResult !== null) {
          return esmResult
        }
        // If no fixture found, throw an error in test mode
        throw createError({
          statusCode: 404,
          statusMessage: 'No esm.sh fixture available',
          message: `No fixture for esm.sh URL: ${url}`,
        })
      }

      const { data } = await event.context.cachedFetch!<any>(url as string, options)
      return data
    }

    // Also override $fetch.raw for esm.sh
    const originalFetchRaw = globalThis.$fetch.raw
    // @ts-expect-error invalid global augmentation
    globalThis.$fetch.raw = async (url, options) => {
      if (typeof url === 'string' && url.startsWith('/')) {
        return originalFetchRaw(url, options)
      }

      // Handle esm.sh requests specially (used by docs feature)
      if (typeof url === 'string' && url.includes('esm.sh')) {
        const esmResult = await handleEsmShRawRequest(url, options, storage)
        if (esmResult !== null) {
          return esmResult
        }
        // If no fixture found, throw an error in test mode
        throw createError({
          statusCode: 404,
          statusMessage: 'No esm.sh fixture available',
          message: `No fixture for esm.sh URL: ${url}`,
        })
      }

      return originalFetchRaw(url, options)
    }
  })
})
