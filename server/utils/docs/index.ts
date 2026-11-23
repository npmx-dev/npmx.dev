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
import { getDocEntries } from './client'
import {
  buildSymbolLookup,
  findUnrecognizedShapes,
  flattenSymbols,
  mergeOverloads,
} from './processing'
import { renderEntries, renderEntriesToc } from './render'
import { computeEntryPrefixes } from './text'
import type { ProcessedEntry } from './types'

let hasReportedUnrecognizedShapes = false

/**
 * The WASM output changes for every package at once, so one report per process is enough.
 */
function reportUnrecognizedShapes(packageName: string, version: string, shapes: string[]) {
  if (hasReportedUnrecognizedShapes) return
  hasReportedUnrecognizedShapes = true
  console.error(
    `[docs] Unrecognized @deno/doc shape in ${packageName}@${version} (${shapes.slice(0, 5).join(', ')}). ` +
      'Docs are not generated until the WASM output is supported again. Further occurrences are not logged.',
  )
}

/**
 * Generate API documentation for an npm package.
 *
 * Uses @deno/doc (WASM build of deno_doc) with esm.sh URLs to extract
 * TypeScript type information and JSDoc comments, then renders them as HTML.
 *
 * @param packageName - The npm package name (e.g., "react", "@types/lodash")
 * @param version - The package version (e.g., "19.2.3")
 * @returns Generated documentation or null if no types are available or the `@deno/doc`
 *   output isn't recognized
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
  const docEntries = await getDocEntries(packageName, version)

  if (docEntries.length === 0) {
    return null
  }

  const flattened = docEntries.map(entry => ({
    entryPoint: entry.entryPoint,
    nodes: flattenSymbols(entry.symbols),
  }))

  // Rendering such nodes would produce plausible but wrong output, so produce no docs instead.
  const unrecognized = flattened.flatMap(entry => findUnrecognizedShapes(entry.nodes))
  if (unrecognized.length > 0) {
    reportUnrecognizedShapes(packageName, version, unrecognized)
    return null
  }

  const entries = flattened
    .map(({ entryPoint, nodes }) => ({ entryPoint, nodes, symbols: mergeOverloads(nodes) }))
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
