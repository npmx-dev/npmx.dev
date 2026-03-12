/**
 * Deno Integration (WASM)
 *
 * Uses @deno/doc (WASM build of deno_doc) for documentation generation.
 * This runs entirely in Node.js without requiring a Deno subprocess.
 *
 * @module server/utils/docs/client
 */

import { doc, type DocNode } from '@deno/doc'
import type { DenoDocNode, DenoDocResult } from '#shared/types/deno-doc'
import { isBuiltin } from 'node:module'
import { encodePackageName } from '#shared/utils/npm'

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for fetching modules in milliseconds */
const FETCH_TIMEOUT_MS = 30 * 1000

/** Maximum number of subpath exports to process */
const MAX_SUBPATH_EXPORTS = 20

// =============================================================================
// Main Export
// =============================================================================

/**
 * Get documentation nodes for a package using @deno/doc WASM.
 */
export async function getDocNodes(packageName: string, version: string): Promise<DenoDocResult> {
  // Get types URL from esm.sh header for the root entry
  const typesUrls = await getTypesUrls(packageName, version)

  if (typesUrls.length === 0) {
    return { version: 1, nodes: [] }
  }

  // Generate docs using @deno/doc WASM
  let result: Record<string, DocNode[]>
  try {
    result = await doc(typesUrls, {
      load: createLoader(),
      resolve: createResolver(),
    })
  } catch {
    return { version: 1, nodes: [] }
  }

  // Collect all nodes from all specifiers
  const allNodes: DenoDocNode[] = []
  for (const nodes of Object.values(result)) {
    allNodes.push(...(nodes as DenoDocNode[]))
  }

  return { version: 1, nodes: allNodes }
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
    const url = URL.parse(specifier)

    if (url === null) {
      return undefined
    }

    // Only handle http/https URLs
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return undefined
    }

    try {
      const response = await $fetch.raw<Blob>(url.toString(), {
        method: 'GET',
        timeout: FETCH_TIMEOUT_MS,
        redirect: 'follow',
      })

      if (response.status !== 200) {
        return undefined
      }

      const content = (await response._data?.text()) ?? ''
      const headers: Record<string, string> = {}
      for (const [key, value] of response.headers) {
        headers[key.toLowerCase()] = value
      }

      return {
        kind: 'module',
        specifier: response.url || specifier,
        headers,
        content,
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
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
    if (
      !specifier.startsWith('http://') &&
      !specifier.startsWith('https://') &&
      !isBuiltin(specifier)
    ) {
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
 * Get TypeScript types URLs for a package, trying the root entry first,
 * then falling back to subpath exports if the package has no default export.
 */
async function getTypesUrls(packageName: string, version: string): Promise<string[]> {
  // Try root entry first
  const rootTypesUrl = await getTypesUrlForSubpath(packageName, version)
  if (rootTypesUrl) {
    return [rootTypesUrl]
  }

  // Root has no types — check subpath exports from the npm registry
  const subpaths = await getSubpathExports(packageName, version)
  if (subpaths.length === 0) {
    return []
  }

  // Fetch types URLs for each subpath export in parallel
  const results = await Promise.all(
    subpaths.map(subpath => getTypesUrlForSubpath(packageName, version, subpath)),
  )

  return results.filter((url): url is string => url !== null)
}

/**
 * Get documentation nodes for a specific subpath export of a package.
 */
export async function getDocNodesForEntrypoint(
  packageName: string,
  version: string,
  entrypoint: string,
): Promise<DenoDocResult> {
  const typesUrl = await getTypesUrlForSubpath(packageName, version, entrypoint)

  if (!typesUrl) {
    return { version: 1, nodes: [] }
  }

  let result: Record<string, DocNode[]>
  try {
    result = await doc([typesUrl], {
      load: createLoader(),
      resolve: createResolver(),
    })
  } catch {
    return { version: 1, nodes: [] }
  }

  const allNodes: DenoDocNode[] = []
  for (const nodes of Object.values(result)) {
    allNodes.push(...(nodes as DenoDocNode[]))
  }

  return { version: 1, nodes: allNodes }
}

/**
 * Get the TypeScript types URL from esm.sh's x-typescript-types header.
 *
 * esm.sh serves types URL in the `x-typescript-types` header, not at the main URL.
 * Example: curl -sI 'https://esm.sh/ufo@1.5.0' returns header:
 *   x-typescript-types: https://esm.sh/ufo@1.5.0/dist/index.d.ts
 */
export async function getTypesUrlForSubpath(
  packageName: string,
  version: string,
  subpath?: string,
): Promise<string | null> {
  const url = subpath
    ? `https://esm.sh/${packageName}@${version}/${subpath}`
    : `https://esm.sh/${packageName}@${version}`

  try {
    const response = await $fetch.raw(url, {
      method: 'HEAD',
      timeout: FETCH_TIMEOUT_MS,
    })
    return response.headers.get('x-typescript-types')
  } catch {
    return null
  }
}

/**
 * Get subpath export paths from the npm registry's package.json `exports` field.
 * Only returns subpaths that declare types (have a `types` condition).
 *
 * Skips the root export (".") since that's handled by the main getTypesUrl call.
 * Skips wildcard patterns ("./foo/*") since they can't be resolved to specific files.
 */
export async function getSubpathExports(packageName: string, version: string): Promise<string[]> {
  try {
    const encodedName = encodePackageName(packageName)
    const pkgJson = await $fetch<Record<string, unknown>>(
      `https://registry.npmjs.org/${encodedName}/${version}`,
      { timeout: FETCH_TIMEOUT_MS },
    )

    const exports = pkgJson.exports
    if (!exports || typeof exports !== 'object') {
      return []
    }

    const subpaths: string[] = []

    for (const [key, value] of Object.entries(exports as Record<string, unknown>)) {
      // Skip root export (already tried), non-subpath entries, and wildcards
      if (key === '.' || !key.startsWith('./') || key.includes('*')) {
        continue
      }

      // Only include exports that declare types
      if (value && typeof value === 'object' && 'types' in value) {
        // Strip leading "./" for the esm.sh URL
        subpaths.push(key.slice(2))
      }

      if (subpaths.length >= MAX_SUBPATH_EXPORTS) {
        break
      }
    }

    return subpaths
  } catch {
    return []
  }
}
