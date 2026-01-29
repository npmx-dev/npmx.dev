/**
 * Internal Types for Docs Module
 * These are highly coupled to `deno doc`, hence they live here instead of shared types.
 *
 * @module server/utils/docs/types
 */

import type { DenoDocNode } from '#shared/types/deno-doc'

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
  nodes: DenoDocNode[]
  jsDoc?: DenoDocNode['jsDoc']
}
