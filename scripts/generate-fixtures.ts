#!/usr/bin/env npx tsx
/**
 * Fixture Generator Script
 *
 * Fetches data from npm registry and API, saving as JSON fixtures
 * for use in CI tests.
 *
 * Usage:
 *   pnpm generate:fixtures           # Generate all fixtures
 *   pnpm generate:fixtures vue nuxt  # Generate specific packages only
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FIXTURES_DIR = fileURLToPath(new URL('../test/fixtures', import.meta.url))

const NPM_REGISTRY = 'https://registry.npmjs.org'
const NPM_API = 'https://api.npmjs.org'

// ============================================================================
// Configuration: What fixtures to generate
// ============================================================================

/**
 * Packages required by E2E tests.
 * These are the packages that tests navigate to or expect data from.
 */
const REQUIRED_PACKAGES = [
  // Unscoped packages
  'nuxt',
  'vue',
  'lodash',
  'vite',
  'next',
  'color',
  'ufo',
  'is-odd',
  'date-fns',
  'lodash.merge',
  // Create packages (checked via relationship from main packages)
  'create-vite',
  'create-next-app',
  'create-nuxt',
  // Scoped packages
  '@nuxt/kit',
  '@vitejs/plugin-vue',
  '@babel/core',
  '@types/node',
] as const

/**
 * Search queries used in tests.
 */
const REQUIRED_SEARCHES = ['vue', 'nuxt', 'keywords:framework'] as const

/**
 * Organizations whose package lists are needed.
 */
const REQUIRED_ORGS = ['nuxt'] as const

/**
 * Users whose package lists are needed.
 */
const REQUIRED_USERS = ['sindresorhus'] as const

// ============================================================================
// Utility Functions
// ============================================================================

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true })
  }
}

function writeFixture(path: string, data: unknown): void {
  ensureDir(dirname(path))
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n')
  console.log(`  Written: ${path}`)
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`)
  }
  return response.json() as Promise<T>
}

function encodePackageName(name: string): string {
  // Encode scoped packages: @scope/name -> @scope%2Fname
  if (name.startsWith('@')) {
    return '@' + encodeURIComponent(name.slice(1))
  }
  return encodeURIComponent(name)
}

function packageToFilename(name: string): string {
  return `${name}.json`
}

function searchQueryToFilename(query: string): string {
  return `${query.replace(/:/g, '-')}.json`
}

// ============================================================================
// Packument Slimming
// ============================================================================

/**
 * Number of recent versions to keep in slimmed packuments.
 * This matches the RECENT_VERSIONS_COUNT in useNpmRegistry.ts
 */
const RECENT_VERSIONS_COUNT = 10

/**
 * Slim down a packument to only essential fields.
 * This dramatically reduces file size while keeping all data tests need.
 */
function slimPackument(pkg: Record<string, unknown>): Record<string, unknown> {
  const distTags = (pkg['dist-tags'] ?? {}) as Record<string, string>
  const versions = (pkg.versions ?? {}) as Record<string, Record<string, unknown>>
  const time = (pkg.time ?? {}) as Record<string, string>

  // Get versions pointed to by dist-tags
  const distTagVersions = new Set(Object.values(distTags))

  // Get recent versions by publish time
  const recentVersions = Object.keys(versions)
    .filter(v => time[v])
    .sort((a, b) => {
      const timeA = time[a]
      const timeB = time[b]
      if (!timeA || !timeB) return 0
      return new Date(timeB).getTime() - new Date(timeA).getTime()
    })
    .slice(0, RECENT_VERSIONS_COUNT)

  // Combine: recent versions + dist-tag versions (deduplicated)
  const includedVersions = new Set([...recentVersions, ...distTagVersions])

  // Build filtered versions object - keep full version data for included versions
  const filteredVersions: Record<string, Record<string, unknown>> = {}
  for (const v of includedVersions) {
    const version = versions[v]
    if (version) {
      // Keep most fields but remove readme from individual versions
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { readme, ...rest } = version
      filteredVersions[v] = rest
    }
  }

  // Build filtered time object (only for included versions + metadata)
  const filteredTime: Record<string, string> = {}
  if (time.modified) filteredTime.modified = time.modified
  if (time.created) filteredTime.created = time.created
  for (const v of includedVersions) {
    if (time[v]) filteredTime[v] = time[v]
  }

  // Return slimmed packument
  return {
    '_id': pkg._id,
    '_rev': pkg._rev,
    'name': pkg.name,
    'description': pkg.description,
    'dist-tags': distTags,
    'versions': filteredVersions,
    'time': filteredTime,
    'maintainers': pkg.maintainers,
    'author': pkg.author,
    'license': pkg.license,
    'homepage': pkg.homepage,
    'keywords': pkg.keywords,
    'repository': pkg.repository,
    'bugs': pkg.bugs,
    // Keep readme at root level (used for package page)
    'readme': pkg.readme,
    'readmeFilename': pkg.readmeFilename,
  }
}

// ============================================================================
// Fixture Generators
// ============================================================================

async function generatePackumentFixture(packageName: string): Promise<void> {
  console.log(`  Fetching packument: ${packageName}`)

  const encoded = encodePackageName(packageName)
  const url = `${NPM_REGISTRY}/${encoded}`

  try {
    const data = await fetchJson<Record<string, unknown>>(url)
    const slimmed = slimPackument(data)
    const filename = packageToFilename(packageName)
    const path = join(FIXTURES_DIR, 'npm-registry', 'packuments', filename)
    writeFixture(path, slimmed)
  } catch (error) {
    console.error(`  Failed to fetch ${packageName}:`, error)
    throw error
  }
}

async function generateDownloadsFixture(packageName: string): Promise<void> {
  console.log(`  Fetching downloads: ${packageName}`)

  const encoded = encodePackageName(packageName)
  const url = `${NPM_API}/downloads/point/last-week/${encoded}`

  try {
    const data = await fetchJson(url)
    const filename = packageToFilename(packageName)
    const path = join(FIXTURES_DIR, 'npm-api', 'downloads', filename)
    writeFixture(path, data)
  } catch (error) {
    console.error(`  Failed to fetch downloads for ${packageName}:`, error)
    // Downloads are optional, don't throw
  }
}

async function generateSearchFixture(query: string): Promise<void> {
  console.log(`  Fetching search: ${query}`)

  const params = new URLSearchParams({ text: query, size: '25' })
  const url = `${NPM_REGISTRY}/-/v1/search?${params}`

  try {
    const data = await fetchJson(url)
    const filename = searchQueryToFilename(query)
    const path = join(FIXTURES_DIR, 'npm-registry', 'search', filename)
    writeFixture(path, data)
  } catch (error) {
    console.error(`  Failed to fetch search "${query}":`, error)
    throw error
  }
}

async function generateOrgFixture(orgName: string): Promise<void> {
  console.log(`  Fetching org packages: ${orgName}`)

  const url = `${NPM_REGISTRY}/-/org/${encodeURIComponent(orgName)}/package`

  try {
    const data = await fetchJson(url)
    const path = join(FIXTURES_DIR, 'npm-registry', 'orgs', `${orgName}.json`)
    writeFixture(path, data)
  } catch (error) {
    console.error(`  Failed to fetch org ${orgName}:`, error)
    throw error
  }
}

async function generateUserFixture(username: string): Promise<void> {
  console.log(`  Fetching user packages: ${username}`)

  // npm doesn't have a direct API for user packages, but we can search
  // with the maintainer filter
  const params = new URLSearchParams({
    text: `maintainer:${username}`,
    size: '100',
  })
  const url = `${NPM_REGISTRY}/-/v1/search?${params}`

  try {
    const data = await fetchJson(url)
    const path = join(FIXTURES_DIR, 'users', `${username}.json`)
    writeFixture(path, data)
  } catch (error) {
    console.error(`  Failed to fetch user ${username}:`, error)
    throw error
  }
}

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)

  // If specific packages are provided, only generate those
  const specificPackages = args.filter(arg => !arg.startsWith('-'))

  console.log('\n=== Generating Test Fixtures ===\n')

  // Determine which packages to generate
  const packagesToGenerate = specificPackages.length > 0 ? specificPackages : [...REQUIRED_PACKAGES]

  // Generate packument fixtures
  console.log('\nPackuments:')
  for (const pkg of packagesToGenerate) {
    await generatePackumentFixture(pkg)
  }

  // Generate downloads fixtures
  console.log('\nDownloads:')
  for (const pkg of packagesToGenerate) {
    await generateDownloadsFixture(pkg)
  }

  // Only generate search/org/user fixtures when doing a full generation
  if (specificPackages.length === 0) {
    // Generate search fixtures
    console.log('\nSearch Results:')
    for (const query of REQUIRED_SEARCHES) {
      await generateSearchFixture(query)
    }

    // Generate org fixtures
    console.log('\nOrganizations:')
    for (const org of REQUIRED_ORGS) {
      await generateOrgFixture(org)
    }

    // Generate user fixtures
    console.log('\nUsers:')
    for (const user of REQUIRED_USERS) {
      await generateUserFixture(user)
    }
  }

  console.log('\n=== Fixture Generation Complete ===\n')
}

main().catch(error => {
  console.error('Fixture generation failed:', error)
  process.exit(1)
})
