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
import { renderEntries, renderEntriesToc } from './render'
import { computeEntryPrefixes } from './text'
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

  // An empty prefix means "render flat": a lone entry, or the root export of a
  // multi-entry package, keeps unprefixed anchor IDs.
  const prefixes =
    entries.length > 1 ? computeEntryPrefixes(entries.map(entry => entry.entryPoint)) : null

  const processed: ProcessedEntry[] = entries.map(entry => {
    const prefix = prefixes?.get(entry.entryPoint) ?? ''
    return {
      entryPoint: entry.entryPoint,
      prefix,
      symbols: entry.symbols,
      lookup: buildSymbolLookup(entry.nodes, prefix),
    }
  })

  return {
    html: await renderEntries(processed),
    toc: renderEntriesToc(processed),
  }
}
