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
import { getDocNodes } from './client'
import { buildSymbolLookup, flattenNamespaces, mergeOverloads } from './processing'
import { renderDocNodes, renderGroupedDocNodes, renderGroupedToc, renderToc } from './render'
import { entrySlug } from './text'
import type { ProcessedEntry } from './types'

/**
 * Generate API documentation for an npm package.
 *
 * Uses @deno/doc (WASM build of deno_doc) with esm.sh URLs to extract
 * TypeScript type information and JSDoc comments, then renders them as HTML.
 *
 * @param packageName - The npm package name (e.g., "react", "@types/lodash")
 * @param version - The package version (e.g., "19.2.3")
 * @returns Generated documentation or null if no types are available
 *
 * @example
 * ```ts
 * const docs = await generateDocsWithDeno('ufo', '1.5.0')
 * if (docs) {
 *   console.log(docs.html)
 * }
 * ```
 */
export async function generateDocsWithDeno(
  packageName: string,
  version: string,
): Promise<DocsGenerationResult | null> {
  // Get doc nodes (grouped by entry point) using @deno/doc WASM
  const result = await getDocNodes(packageName, version)

  if (result.entries.length === 0) {
    return null
  }

  const entries = result.entries
    .map(entry => {
      const flattenedNodes = flattenNamespaces(entry.nodes)
      return {
        entryPoint: entry.entryPoint,
        nodes: flattenedNodes,
        symbols: mergeOverloads(flattenedNodes),
      }
    })
    .filter(entry => entry.symbols.length > 0)

  if (entries.length === 0) {
    return null
  }

  const isMultiEntry = entries.length > 1

  // Anchor IDs are only prefixed when multiple entry points share a page. The root entry
  // is never prefixed, so a package that also ships a root export keeps clean
  // root IDs while namespacing submodules.
  const processed: ProcessedEntry[] = entries.map(entry => {
    const prefix = isMultiEntry && entry.entryPoint !== '.' ? entrySlug(entry.entryPoint) : ''
    return {
      entryPoint: entry.entryPoint,
      nodes: entry.nodes,
      symbols: entry.symbols,
      lookup: buildSymbolLookup(entry.nodes, prefix),
    }
  })

  const allNodes = processed.flatMap(entry => entry.nodes)

  if (!isMultiEntry) {
    const entry = processed[0]!
    const html = await renderDocNodes(entry.symbols, entry.lookup)
    const toc = renderToc(entry.symbols)
    return { html, toc, nodes: allNodes }
  }

  // Render HTML and TOC from pre-computed merged symbols
  const html = await renderGroupedDocNodes(processed)
  const toc = renderGroupedToc(processed)

  return { html, toc, nodes: allNodes }
}
