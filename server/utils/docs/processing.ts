/**
 * Node Processing
 *
 * Functions for processing deno doc output: flattening namespaces,
 * merging overloads, and building symbol lookups.
 *
 * @module server/utils/docs/processing
 */

import type { DenoDocNode } from '#shared/types/deno-doc'
import type { MergedSymbol, SymbolLookup } from './types'
import { cleanSymbolName, createSymbolId } from './text'

/**
 * Flatten namespace elements into top-level nodes for easier display.
 * Also filters out import/reference nodes that aren't useful for docs.
 */
export function flattenNamespaces(nodes: DenoDocNode[]): DenoDocNode[] {
  const result: DenoDocNode[] = []

  for (const node of nodes) {
    // Skip internal nodes
    if (node.kind === 'import' || node.kind === 'reference') {
      continue
    }

    result.push(node)

    // Inline namespace members with qualified names
    if (node.kind === 'namespace' && node.namespaceDef?.elements) {
      for (const element of node.namespaceDef.elements) {
        result.push({
          ...element,
          name: `${node.name}.${element.name}`,
        })
      }
    }
  }

  return result
}

/**
 * Build a lookup table mapping symbol names to their HTML anchor IDs.
 * Used for {@link} cross-references.
 */
export function buildSymbolLookup(nodes: DenoDocNode[]): SymbolLookup {
  const lookup = new Map<string, string>()

  for (const node of nodes) {
    const cleanName = cleanSymbolName(node.name)
    const id = createSymbolId(node.kind, cleanName)
    lookup.set(cleanName, id)
  }

  return lookup
}

/**
 * Merge function/method overloads into single entries.
 *
 * TypeScript packages often export many overloads for the same function
 * (e.g., React's `h` has 23 overloads). This groups them together.
 */
export function mergeOverloads(nodes: DenoDocNode[]): MergedSymbol[] {
  const byKey = new Map<string, DenoDocNode[]>()

  for (const node of nodes) {
    const cleanName = cleanSymbolName(node.name)
    const key = `${node.kind}:${cleanName}`
    const existing = byKey.get(key)
    if (existing) {
      existing.push(node)
    } else {
      byKey.set(key, [node])
    }
  }

  const result: MergedSymbol[] = []

  for (const [, groupedNodes] of byKey) {
    const first = groupedNodes[0]
    if (!first) continue // Should never happen, but defensive programming etc

    // Use JSDoc from the best-documented overload
    const withDoc = groupedNodes.find(n => n.jsDoc?.doc) ?? first

    result.push({
      name: cleanSymbolName(first.name),
      kind: first.kind,
      nodes: groupedNodes,
      jsDoc: withDoc.jsDoc,
    })
  }

  // Sort alphabetically
  result.sort((a, b) => a.name.localeCompare(b.name))

  return result
}

/**
 * Group merged symbols by their kind (function, class, etc.)
 */
export function groupMergedByKind(symbols: MergedSymbol[]): Record<string, MergedSymbol[]> {
  const grouped: Record<string, MergedSymbol[]> = {}

  for (const sym of symbols) {
    const kindGroup = (grouped[sym.kind] ??= [])
    kindGroup.push(sym)
  }

  return grouped
}
