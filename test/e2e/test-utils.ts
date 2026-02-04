import { test as base } from '@nuxt/test-utils/playwright'
import type { Page, Route } from '@playwright/test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const FIXTURES_DIR = join(process.cwd(), 'test/fixtures')

function readFixture(relativePath: string): unknown | null {
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
 */
function parseScopedPackage(input: string): { name: string; version?: string } {
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

function packageToFixturePath(packageName: string): string {
  if (packageName.startsWith('@')) {
    const [scope, name] = packageName.slice(1).split('/')
    if (!name) {
      // Guard against invalid scoped package format like just "@scope"
      return `npm-registry/packuments/${packageName}.json`
    }
    return `npm-registry/packuments/@${scope}/${name}.json`
  }
  return `npm-registry/packuments/${packageName}.json`
}

async function handleNpmRegistry(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  const pathname = decodeURIComponent(url.pathname)

  // Search endpoint
  if (pathname === '/-/v1/search') {
    const query = url.searchParams.get('text')
    if (query) {
      const maintainerMatch = query.match(/^maintainer:(.+)$/)
      if (maintainerMatch?.[1]) {
        const fixture = readFixture(`users/${maintainerMatch[1]}.json`)
        await route.fulfill({
          json: fixture || { objects: [], total: 0, time: new Date().toISOString() },
        })
        return true
      }

      const searchName = query.replace(/:/g, '-')
      const fixture = readFixture(`npm-registry/search/${searchName}.json`)
      await route.fulfill({
        json: fixture || { objects: [], total: 0, time: new Date().toISOString() },
      })
      return true
    }
  }

  // Org packages
  const orgMatch = pathname.match(/^\/-\/org\/([^/]+)\/package$/)
  if (orgMatch?.[1]) {
    const fixture = readFixture(`npm-registry/orgs/${orgMatch[1]}.json`)
    if (fixture) {
      await route.fulfill({ json: fixture })
      return true
    }
    await route.fulfill({ status: 404, json: { error: 'Not found' } })
    return true
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
      await route.fulfill({ json: fixture })
      return true
    }
    await route.fulfill({ status: 404, json: { error: 'Not found' } })
    return true
  }

  return false
}

async function handleNpmApi(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  const pathname = decodeURIComponent(url.pathname)

  // Downloads point
  const pointMatch = pathname.match(/^\/downloads\/point\/[^/]+\/(.+)$/)
  if (pointMatch?.[1]) {
    const packageName = pointMatch[1]
    const fixture = readFixture(`npm-api/downloads/${packageName}.json`)
    await route.fulfill({
      json: fixture || {
        downloads: 0,
        start: '2025-01-01',
        end: '2025-01-31',
        package: packageName,
      },
    })
    return true
  }

  // Downloads range
  const rangeMatch = pathname.match(/^\/downloads\/range\/[^/]+\/(.+)$/)
  if (rangeMatch?.[1]) {
    const packageName = rangeMatch[1]
    await route.fulfill({
      json: { downloads: [], start: '2025-01-01', end: '2025-01-31', package: packageName },
    })
    return true
  }

  return false
}

async function handleOsvApi(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())

  if (url.pathname === '/v1/querybatch') {
    await route.fulfill({ json: { results: [] } })
    return true
  }

  if (url.pathname.startsWith('/v1/query')) {
    await route.fulfill({ json: { vulns: [] } })
    return true
  }

  return false
}

async function handleFastNpmMeta(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  let packageName = decodeURIComponent(url.pathname.slice(1))

  if (!packageName) return false

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

  const packument = readFixture(packageToFixturePath(packageName)) as Record<string, unknown> | null
  if (!packument) return false

  const distTags = packument['dist-tags'] as Record<string, string> | undefined
  const versions = packument.versions as Record<string, unknown> | undefined
  const time = packument.time as Record<string, string> | undefined

  let version: string | undefined
  if (specifier === 'latest' || !specifier) {
    version = distTags?.latest
  } else if (distTags?.[specifier]) {
    version = distTags[specifier]
  } else if (versions?.[specifier]) {
    version = specifier
  } else {
    version = distTags?.latest
  }

  if (!version) return false

  await route.fulfill({
    json: {
      name: packageName,
      specifier,
      version,
      publishedAt: time?.[version] || new Date().toISOString(),
      lastSynced: Date.now(),
    },
  })
  return true
}

async function handleJsrRegistry(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())

  if (url.pathname.endsWith('/meta.json')) {
    await route.fulfill({ json: null })
    return true
  }

  return false
}

/**
 * Handle Bundlephobia API requests for package size info.
 * Returns mock size data for any package.
 */
async function handleBundlephobiaApi(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())

  if (url.pathname === '/api/size') {
    const packageSpec = url.searchParams.get('package')
    if (packageSpec) {
      // Return mock size data
      await route.fulfill({
        json: {
          name: packageSpec.split('@')[0],
          size: 12345,
          gzip: 4567,
          dependencyCount: 3,
        },
      })
      return true
    }
  }

  return false
}

/**
 * Handle npms.io API requests for package score/quality metrics.
 * Returns mock score data for any package.
 */
async function handleNpmsApi(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  const pathname = decodeURIComponent(url.pathname)

  // Package score endpoint: /v2/package/{packageName}
  const packageMatch = pathname.match(/^\/v2\/package\/(.+)$/)
  if (packageMatch?.[1]) {
    const packageName = packageMatch[1]
    await route.fulfill({
      json: {
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
      },
    })
    return true
  }

  return false
}

/**
 * Handle jsdelivr CDN requests for package files (README, etc.).
 * Returns 404 for most requests since we don't need actual README content for most tests.
 */
async function handleJsdelivrCdn(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  const pathname = decodeURIComponent(url.pathname)

  // README file requests - return 404 (package pages work fine without README)
  if (pathname.match(/readme/i)) {
    await route.fulfill({ status: 404, body: 'Not found' })
    return true
  }

  // Other file requests (package.json, etc.) - return 404
  await route.fulfill({ status: 404, body: 'Not found' })
  return true
}

/**
 * Handle jsdelivr data API requests for package file listings.
 * Returns mock file tree data.
 */
async function handleJsdelivrDataApi(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  const pathname = decodeURIComponent(url.pathname)

  // Package file listing: /v1/packages/npm/{package}@{version}
  const packageMatch = pathname.match(/^\/v1\/packages\/npm\/(.+)$/)
  if (packageMatch?.[1]) {
    const parsed = parseScopedPackage(packageMatch[1])
    // Return a minimal file tree
    await route.fulfill({
      json: {
        type: 'npm',
        name: parsed.name,
        version: parsed.version || 'latest',
        files: [
          { name: 'package.json', hash: 'abc123', size: 1000 },
          { name: 'index.js', hash: 'def456', size: 500 },
          { name: 'README.md', hash: 'ghi789', size: 2000 },
        ],
      },
    })
    return true
  }

  return false
}

/**
 * Handle Gravatar API requests for user avatars.
 * Returns 404 since we don't need actual avatars in tests.
 */
async function handleGravatarApi(route: Route): Promise<boolean> {
  await route.fulfill({ status: 404, body: 'Not found' })
  return true
}

/**
 * Handle GitHub API requests.
 * Returns mock contributor data from fixtures for the contributors endpoint.
 */
async function handleGitHubApi(route: Route): Promise<boolean> {
  const url = new URL(route.request().url())
  const pathname = url.pathname

  // Contributors endpoint: /repos/{owner}/{repo}/contributors
  const contributorsMatch = pathname.match(/^\/repos\/([^/]+)\/([^/]+)\/contributors$/)
  if (contributorsMatch) {
    const fixture = readFixture('github/contributors.json')
    await route.fulfill({
      json: fixture || [],
    })
    return true
  }

  return false
}

/**
 * Fail the test with a clear error message when an external API request isn't mocked.
 */
function failUnmockedRequest(route: Route, apiName: string): never {
  const url = route.request().url()
  const error = new Error(
    `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `UNMOCKED EXTERNAL API REQUEST DETECTED\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `\n` +
      `API:  ${apiName}\n` +
      `URL:  ${url}\n` +
      `\n` +
      `This request would hit a real external API, which is not allowed in tests.\n` +
      `\n` +
      `To fix this, either:\n` +
      `  1. Add a fixture file for this request in test/fixtures/\n` +
      `  2. Add handling for this URL pattern in test/e2e/test-utils.ts\n` +
      `\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`,
  )
  throw error
}

async function setupRouteMocking(page: Page): Promise<void> {
  await page.route('https://registry.npmjs.org/**', async route => {
    const handled = await handleNpmRegistry(route)
    if (!handled) failUnmockedRequest(route, 'npm registry')
  })

  await page.route('https://api.npmjs.org/**', async route => {
    const handled = await handleNpmApi(route)
    if (!handled) failUnmockedRequest(route, 'npm API')
  })

  await page.route('https://api.osv.dev/**', async route => {
    const handled = await handleOsvApi(route)
    if (!handled) failUnmockedRequest(route, 'OSV API')
  })

  await page.route('https://npm.antfu.dev/**', async route => {
    const handled = await handleFastNpmMeta(route)
    if (!handled) failUnmockedRequest(route, 'fast-npm-meta')
  })

  await page.route('https://jsr.io/**', async route => {
    const handled = await handleJsrRegistry(route)
    if (!handled) failUnmockedRequest(route, 'JSR registry')
  })

  // Bundlephobia API for package size info (used by size badges)
  await page.route('https://bundlephobia.com/**', async route => {
    const handled = await handleBundlephobiaApi(route)
    if (!handled) failUnmockedRequest(route, 'Bundlephobia API')
  })

  // npms.io API for package scores (used by quality/popularity/maintenance badges)
  await page.route('https://api.npms.io/**', async route => {
    const handled = await handleNpmsApi(route)
    if (!handled) failUnmockedRequest(route, 'npms.io API')
  })

  // jsdelivr CDN for package files (README, etc.)
  await page.route('https://cdn.jsdelivr.net/**', async route => {
    const handled = await handleJsdelivrCdn(route)
    if (!handled) failUnmockedRequest(route, 'jsdelivr CDN')
  })

  // jsdelivr data API for file listings
  await page.route('https://data.jsdelivr.com/**', async route => {
    const handled = await handleJsdelivrDataApi(route)
    if (!handled) failUnmockedRequest(route, 'jsdelivr Data API')
  })

  // Gravatar API for user avatars
  await page.route('https://www.gravatar.com/**', async route => {
    const handled = await handleGravatarApi(route)
    if (!handled) failUnmockedRequest(route, 'Gravatar API')
  })

  // GitHub API for contributors, etc.
  await page.route('https://api.github.com/**', async route => {
    const handled = await handleGitHubApi(route)
    if (!handled) failUnmockedRequest(route, 'GitHub API')
  })
}

/**
 * Extended test fixture with automatic external API mocking.
 *
 * All external API requests are intercepted and served from fixtures.
 * If a request cannot be mocked, the test will fail with a clear error.
 */
export const test = base.extend<{ mockExternalApis: void }>({
  mockExternalApis: [
    async ({ page }, use) => {
      await setupRouteMocking(page)
      await use()
    },
    { auto: true },
  ],
})

export { expect } from '@nuxt/test-utils/playwright'
