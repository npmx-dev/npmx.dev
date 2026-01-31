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

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for fetching modules in milliseconds */
const FETCH_TIMEOUT_MS = 30 * 1000

// =============================================================================
// Main Export
// =============================================================================

/**
 * Get documentation nodes for a package using @deno/doc WASM.
 */
export async function getDocNodes(packageName: string, version: string): Promise<DenoDocResult> {
  // Get types URL from esm.sh header
  const typesUrl = await getTypesUrl(packageName, version)

  if (!typesUrl) {
    return { version: 1, nodes: [] }
  }

  // Generate docs using @deno/doc WASM
  let result: Record<string, DocNode[]>
  try {
    result = await doc([typesUrl], {
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
    let url: URL
    try {
      url = new URL(specifier)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
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
        specifier: response.url,
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
  const url = `https://esm.sh/${packageName}@${version}`

  try {
    const response = await $fetch.raw(url, {
      method: 'HEAD',
      timeout: FETCH_TIMEOUT_MS,
    })
    return response.headers.get('x-typescript-types')
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return null
  }
}
