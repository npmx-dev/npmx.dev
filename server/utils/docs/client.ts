/**
 * Deno Integration (WASM)
 *
 * Uses @deno/doc (WASM build of deno_doc) for documentation generation.
 * This runs entirely in Node.js without requiring a Deno subprocess.
 *
 * @module server/utils/docs/client
 */

import { doc } from '@deno/doc'
import type { DenoDocNode, DenoDocResult } from '#shared/types/deno-doc'

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for fetching modules in milliseconds */
const FETCH_TIMEOUT_MS = 30 * 1000

/** Maximum number of subpath exports to process (prevents runaway on huge packages) */
const MAX_SUBPATH_EXPORTS = 10

// =============================================================================
// Main Export
// =============================================================================

/**
 * Get documentation nodes for a package using @deno/doc WASM.
 *
 * This function fetches types for all subpath exports (e.g., `nuxt`, `nuxt/app`, `nuxt/kit`)
 * to provide comprehensive documentation for packages with multiple entry points.
 */
export async function getDocNodes(packageName: string, version: string): Promise<DenoDocResult> {
  // Get all types URLs from package exports
  const typesUrls = await getAllTypesUrls(packageName, version)

  if (typesUrls.length === 0) {
    return { version: 1, nodes: [] }
  }

  // Generate docs using @deno/doc WASM for all entry points
  const result = await doc(typesUrls, {
    load: createLoader(),
    resolve: createResolver(),
  })

  // Collect all nodes from all specifiers
  const allNodes: DenoDocNode[] = []
  for (const nodes of Object.values(result)) {
    allNodes.push(...(nodes as DenoDocNode[]))
  }

  return { version: 1, nodes: allNodes }
}

// =============================================================================
// Types URL Discovery
// =============================================================================

/**
 * Get all TypeScript types URLs for a package, including subpath exports.
 *
 * 1. Fetches package.json from npm registry to discover exports
 * 2. For each subpath with types, queries esm.sh for the types URL
 * 3. Returns all discovered types URLs
 */
async function getAllTypesUrls(packageName: string, version: string): Promise<string[]> {
  // First, try the main entry point
  const mainTypesUrl = await getTypesUrl(packageName, version)

  // Fetch package exports to discover subpaths
  const subpathTypesUrls = await getSubpathTypesUrls(packageName, version)

  // Combine and deduplicate
  const allUrls = new Set<string>()
  if (mainTypesUrl) allUrls.add(mainTypesUrl)
  for (const url of subpathTypesUrls) {
    allUrls.add(url)
  }

  return [...allUrls]
}

/**
 * Fetch package.json exports and get types URLs for each subpath.
 */
async function getSubpathTypesUrls(packageName: string, version: string): Promise<string[]> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    // Fetch package.json from npm registry
    const response = await fetch(`https://registry.npmjs.org/${packageName}/${version}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) return []

    const pkgJson = await response.json()
    const exports = pkgJson.exports

    // No exports field or simple string export
    if (!exports || typeof exports !== 'object') return []

    // Find subpaths with types
    const subpathsWithTypes: string[] = []
    for (const [subpath, config] of Object.entries(exports)) {
      // Skip the main entry (already handled) and non-object configs
      if (subpath === '.' || typeof config !== 'object' || config === null) continue
      // Skip package.json export
      if (subpath === './package.json') continue

      const exportConfig = config as Record<string, unknown>
      if (exportConfig.types && typeof exportConfig.types === 'string') {
        subpathsWithTypes.push(subpath)
      }
    }

    // Limit to prevent runaway on huge packages
    const limitedSubpaths = subpathsWithTypes.slice(0, MAX_SUBPATH_EXPORTS)

    // Fetch types URLs for each subpath in parallel
    const typesUrls = await Promise.all(
      limitedSubpaths.map(async subpath => {
        // Convert ./app to /app for esm.sh URL
        // esm.sh format: https://esm.sh/nuxt@3.15.4/app (not nuxt/app@3.15.4)
        const esmSubpath = subpath.startsWith('./') ? subpath.slice(1) : subpath
        return getTypesUrlForSubpath(packageName, version, esmSubpath)
      }),
    )

    return typesUrls.filter((url): url is string => url !== null)
  } catch {
    clearTimeout(timeoutId)
    return []
  }
}

// =============================================================================
// Module Loading
// =============================================================================

/** Load response for the doc() function */
interface LoadResponse {
  kind: 'module'
  specifier: string
  headers?: Record<string, string>
  content: string
}

/**
 * Create a custom module loader for @deno/doc.
 *
 * Fetches modules from URLs using fetch(), with proper timeout handling.
 */
function createLoader(): (
  specifier: string,
  isDynamic?: boolean,
  cacheSetting?: string,
  checksum?: string,
) => Promise<LoadResponse | undefined> {
  return async (
    specifier: string,
    _isDynamic?: boolean,
    _cacheSetting?: string,
    _checksum?: string,
  ) => {
    let url: URL
    try {
      url = new URL(specifier)
    } catch {
      return undefined
    }

    // Only handle http/https URLs
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url.toString(), {
        redirect: 'follow',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.status !== 200) {
        return undefined
      }

      const content = await response.text()
      const headers: Record<string, string> = {}
      for (const [key, value] of response.headers) {
        headers[key.toLowerCase()] = value
      }

      return {
        kind: 'module',
        specifier: response.url,
        headers,
        content,
      }
    } catch {
      clearTimeout(timeoutId)
      return undefined
    }
  }
}

/**
 * Create a module resolver for @deno/doc.
 *
 * Handles resolving relative imports and esm.sh redirects.
 */
function createResolver(): (specifier: string, referrer: string) => string {
  return (specifier: string, referrer: string) => {
    // Handle relative imports
    if (specifier.startsWith('.') || specifier.startsWith('/')) {
      return new URL(specifier, referrer).toString()
    }

    // Handle bare specifiers - resolve through esm.sh
    if (!specifier.startsWith('http://') && !specifier.startsWith('https://')) {
      // Try to resolve bare specifier relative to esm.sh base
      const baseUrl = new URL(referrer)
      if (baseUrl.hostname === 'esm.sh') {
        return `https://esm.sh/${specifier}`
      }
    }

    return specifier
  }
}

/**
 * Get the TypeScript types URL from esm.sh's x-typescript-types header.
 *
 * esm.sh serves types URL in the `x-typescript-types` header, not at the main URL.
 * Example: curl -sI 'https://esm.sh/ufo@1.5.0' returns header:
 *   x-typescript-types: https://esm.sh/ufo@1.5.0/dist/index.d.ts
 */
async function getTypesUrl(packageName: string, version: string): Promise<string | null> {
  return fetchTypesHeader(`https://esm.sh/${packageName}@${version}`)
}

/**
 * Get types URL for a package subpath.
 * Example: getTypesUrlForSubpath('nuxt', '3.15.4', '/app')
 *   → fetches https://esm.sh/nuxt@3.15.4/app
 */
async function getTypesUrlForSubpath(
  packageName: string,
  version: string,
  subpath: string,
): Promise<string | null> {
  return fetchTypesHeader(`https://esm.sh/${packageName}@${version}${subpath}`)
}

/**
 * Fetch the x-typescript-types header from an esm.sh URL.
 */
async function fetchTypesHeader(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response.headers.get('x-typescript-types')
  } catch {
    clearTimeout(timeoutId)
    return null
  }
}
