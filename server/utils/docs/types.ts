/**
 * Internal Types for Docs Module
 * These are highly coupled to `@deno/doc`, hence they live here instead of shared types.
 *
 * @module server/utils/docs/types
 */

import type { Declaration, JsDoc, Symbol as DocSymbol } from '@deno/doc'

/**
 * A single declaration taken out of its `@deno/doc` symbol, carrying the symbol's name.
 * Namespace members are named `Namespace.member`.
 */
export type DocNode = Declaration & { name: string }

/**
 * Documented symbols for one entry point of a package.
 */
export interface DocEntry {
  entryPoint: string
  symbols: DocSymbol[]
}

/**
 * Map of symbol names to anchor IDs for cross-referencing.
 * @internal Exported for testing
 */
export type SymbolLookup = Map<string, string>

/**
 * Symbol with merged overloads
 */
export interface MergedSymbol {
  name: string
  kind: string
  nodes: DocNode[]
  jsDoc?: JsDoc
}

/**
 * Processed entry point with merged symbols and lookup ready for rendering.
 */
export interface ProcessedEntry {
  entryPoint: string
  prefix: string
  symbols: MergedSymbol[]
  lookup: SymbolLookup
}
