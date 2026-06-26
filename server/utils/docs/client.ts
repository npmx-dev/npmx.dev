/**
 * Deno Integration (WASM)
 *
 * Uses @deno/doc (WASM build of deno_doc) for documentation generation.
 * This runs entirely in Node.js without requiring a Deno subprocess.
 *
 * @module server/utils/docs/client
 */

import { doc, type DocNode } from '@deno/doc'
import type { DenoDocNode, DenoDocResult, DocEntry } from '#shared/types/deno-doc'
import { isBuiltin } from 'node:module'
import { exports as resolveExports } from 'resolve.exports'

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
  const entryPoints = await resolveEntryPoints(packageName, version)

  if (entryPoints.length === 0) {
    return { version: 1, entries: [] }
  }

  const entries: (DocEntry | null)[] = await Promise.all(
    entryPoints.map(async ({ entryPoint, typesUrl }): Promise<DocEntry | null> => {
      let result: Record<string, DocNode[]>
      try {
        result = await doc([typesUrl], {
          load: createLoader(),
          resolve: createResolver(),
        })
      } catch {
        return null
      }

      const nodes: DenoDocNode[] = []
      for (const docNodes of Object.values(result)) {
        nodes.push(...(docNodes as DenoDocNode[]))
      }

      if (nodes.length === 0) {
        return null
      }

      return { entryPoint, nodes }
    }),
  )

  return {
    version: 1,
    entries: entries.filter((entry): entry is DocEntry => entry !== null),
  }
}

// =============================================================================
// Entry Point Resolution
// =============================================================================

interface ResolvedEntryPoint {
  entryPoint: string
  typesUrl: string
}

/**
 * Resolve the documentable entry points for a package.
 */
async function resolveEntryPoints(
  packageName: string,
  version: string,
): Promise<ResolvedEntryPoint[]> {
  const modules = await getModules(packageName, version)

  const resolved = await Promise.all(
    modules.map(async (entryPoint): Promise<ResolvedEntryPoint | null> => {
      const submodule = entryPoint === '.' ? '' : entryPoint.replace(/^\./, '')
      const typesUrl = await getTypesUrl(packageName, version, submodule)
      return typesUrl ? { entryPoint, typesUrl } : null
    }),
  )

  return resolved.filter((entry): entry is ResolvedEntryPoint => entry !== null)
}

/** Minimal package manifest shape needed to resolve entry points. */
interface PackageManifest {
  name: string
  exports?: unknown
}

/**
 * Resolve importable module specifiers for a package.
 */
async function getModules(packageName: string, version: string): Promise<string[]> {
  let pkg: PackageManifest
  try {
    pkg = await $fetch<PackageManifest>(
      `https://esm.sh/${encodePackageName(packageName)}/${version}/package.json`,
      { timeout: FETCH_TIMEOUT_MS },
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error(e)
    return ['.']
  }

  const exportsField = pkg.exports
  if (!exportsField || typeof exportsField !== 'object' || Array.isArray(exportsField)) {
    return ['.']
  }

  // A submodule map keys entries by `.`/`./*`; a bare conditions map (e.g. only
  // `import`/`require`) describes the root entry, so treat it as root-only.
  const subpathKeys = Object.keys(exportsField).filter(key => key === '.' || key.startsWith('./'))
  if (subpathKeys.length === 0) {
    return ['.']
  }

  const candidates = subpathKeys.filter(key => key !== './package.json' && !key.includes('*'))

  // Keep only specifiers that actually resolve to a target
  const modules = candidates.filter(key => {
    try {
      const target = resolveExports(pkg, key)
      return Boolean(target && target.length > 0)
    } catch {
      return false
    }
  })

  // Order module specifiers with the root `.` first, then alphabetically.
  return [...modules].sort((a, b) => {
    if (a === b) return 0
    if (a === '.') return -1
    if (b === '.') return 1
    return a.localeCompare(b)
  })
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
 * Get the TypeScript types URL from esm.sh's x-typescript-types header.
 *
 * esm.sh serves types URL in the `x-typescript-types` header, not at the main URL.
 * Example: curl -sI 'https://esm.sh/ufo@1.5.0' returns header:
 *   x-typescript-types: https://esm.sh/ufo@1.5.0/dist/index.d.ts
 */
async function getTypesUrl(
  packageName: string,
  version: string,
  submodule = '',
): Promise<string | null> {
  const url = `https://esm.sh/${packageName}@${version}${submodule}`

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
