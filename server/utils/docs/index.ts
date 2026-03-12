/**
 * API Documentation Generator
 *
 * Generates TypeScript API documentation for npm packages.
 * Uses esm.sh to resolve package types, which handles @types/* packages automatically.
 * Uses @deno/doc (WASM build of deno_doc) for documentation generation.
 *
 * @module server/utils/docs
 */

import type { DocsGenerationResult } from '#shared/types/deno-doc'
import {
  getDocNodes,
  getDocNodesForEntrypoint,
  getSubpathExports,
  getTypesUrlForSubpath,
} from './client'
import { buildSymbolLookup, flattenNamespaces, mergeOverloads } from './processing'
import { renderDocNodes, renderToc } from './render'

/**
 * Generate API documentation for an npm package (or a specific entrypoint).
 *
 * Uses @deno/doc (WASM build of deno_doc) with esm.sh URLs to extract
 * TypeScript type information and JSDoc comments, then renders them as HTML.
 *
 * @param packageName - The npm package name (e.g., "react", "@types/lodash")
 * @param version - The package version (e.g., "19.2.3")
 * @param entrypoint - Optional subpath export (e.g., "router.js") for multi-entrypoint packages
 * @returns Generated documentation or null if no types are available
 */
export async function generateDocsWithDeno(
  packageName: string,
  version: string,
  entrypoint?: string,
): Promise<DocsGenerationResult | null> {
  // Get doc nodes using @deno/doc WASM
  const result = entrypoint
    ? await getDocNodesForEntrypoint(packageName, version, entrypoint)
    : await getDocNodes(packageName, version)

  if (!result.nodes || result.nodes.length === 0) {
    return null
  }

  // Process nodes: flatten namespaces, merge overloads, and build lookup
  const flattenedNodes = flattenNamespaces(result.nodes)
  const mergedSymbols = mergeOverloads(flattenedNodes)
  const symbolLookup = buildSymbolLookup(flattenedNodes)

  // Render HTML and TOC from pre-computed merged symbols
  const html = await renderDocNodes(mergedSymbols, symbolLookup)
  const toc = renderToc(mergedSymbols)

  return { html, toc, nodes: flattenedNodes }
}

/**
 * Get the list of subpath exports for a package, or null if it's a
 * single-entrypoint package (has a root export with types).
 */
export async function getEntrypoints(
  packageName: string,
  version: string,
): Promise<string[] | null> {
  // Check if root entry has types
  const rootTypesUrl = await getTypesUrlForSubpath(packageName, version)
  if (rootTypesUrl) {
    return null
  }

  // Multi-entrypoint: return subpath exports
  const subpaths = await getSubpathExports(packageName, version)
  return subpaths.length > 0 ? subpaths : null
}
