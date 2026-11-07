/**
 * Node Processing
 *
 * Functions for processing `@deno/doc` output: flattening symbols and namespaces,
 * merging overloads, and building symbol lookups.
 *
 * @module server/utils/docs/processing
 */

import type {
  ClassMethodDef,
  DeclarationEnum,
  EnumDef,
  EnumMemberDef,
  FunctionDef,
  Symbol as DocSymbol,
} from '@deno/doc'
import type { DocNode, MergedSymbol, SymbolLookup } from './types'
import { cleanSymbolName, createMemberId, createSymbolId } from './text'

function flattenSymbol(symbol: DocSymbol, qualifier = '', result: DocNode[] = []): DocNode[] {
  for (const declaration of symbol.declarations) {
    if (declaration.kind === 'reference') continue

    const node: DocNode = { ...declaration, name: `${qualifier}${symbol.name}` }
    result.push(node)

    if (node.kind === 'namespace') {
      for (const element of node.def.elements) {
        flattenSymbol(element, `${node.name}.`, result)
      }
    }
  }

  return result
}

/**
 * Turn symbols into one node per declaration, inlining namespace members (at any depth) under
 * qualified names for easier display. Re-exports aren't useful for docs, so they are skipped.
 */
export function flattenSymbols(symbols: DocSymbol[]): DocNode[] {
  const result: DocNode[] = []
  for (const symbol of symbols) flattenSymbol(symbol, '', result)
  return result
}

function isFunctionDef(value: unknown): value is FunctionDef {
  return (
    typeof value === 'object' && value !== null && 'params' in value && Array.isArray(value.params)
  )
}

function isEnumDef(value: unknown): value is EnumDef {
  return (
    typeof value === 'object' &&
    value !== null &&
    'members' in value &&
    Array.isArray(value.members)
  )
}

/**
 * Get the function definition of a class method.
 *
 * The published `@deno/doc` types name this field `def`, but the WASM build emits `functionDef`.
 *
 * Remove once fixed upstream.
 * The canary test in `pipeline.spec.ts` fails when the WASM output matches the types again.
 */
export function getMethodDef(method: ClassMethodDef): FunctionDef | undefined {
  const candidate: unknown = 'functionDef' in method ? method.functionDef : method.def
  return isFunctionDef(candidate) ? candidate : undefined
}

function getEnumDef(node: DeclarationEnum & { name: string }): EnumDef | undefined {
  const candidate: unknown = 'def' in node ? node.def : node.enumDef
  return isEnumDef(candidate) ? candidate : undefined
}

/**
 * Get the members of an enum node.
 *
 * The published `@deno/doc` types name this field `enumDef`, but the WASM build emits `def`.
 *
 * Remove once fixed upstream.
 * The canary test in `pipeline.spec.ts` fails when the WASM output matches the types again.
 */
export function getEnumMembers(node: DeclarationEnum & { name: string }): EnumMemberDef[] {
  return getEnumDef(node)?.members ?? []
}

/**
 * Describe the class methods and enums whose `@deno/doc` shape isn't recognised by
 * {@link getMethodDef} and {@link getEnumMembers}, so the caller can bail out instead of
 * rendering them without their signature or members.
 */
export function findUnrecognizedShapes(nodes: DocNode[]): string[] {
  const problems: string[] = []
  for (const node of nodes) {
    if (node.kind === 'enum' && !getEnumDef(node)) {
      problems.push(`enum "${node.name}"`)
    } else if (node.kind === 'class') {
      for (const method of node.def.methods ?? []) {
        if (!getMethodDef(method)) problems.push(`class method "${node.name}.${method.name}"`)
      }
    }
  }
  return problems
}

/**
 * Build a lookup table mapping symbol names to their HTML anchor IDs.
 * Used for {@link} cross-references.
 *
 * Class, interface and enum members are reachable as `Symbol.member` and `Symbol#member`.
 */
export function buildSymbolLookup(nodes: DocNode[], prefix = ''): SymbolLookup {
  const lookup = new Map<string, string>()
  const memberEntries: Array<[string, string]> = []
  const symbolsWithMembers = new Set<string>()

  for (const node of nodes) {
    const cleanName = cleanSymbolName(node.name)
    const id = createSymbolId(node.kind, cleanName, prefix)
    lookup.set(cleanName, id)

    // Only the first declaration of a merged symbol has its members rendered, so later ones
    // (e.g. a re-opened interface) would point to anchors that don't exist.
    const symbolKey = `${node.kind}:${cleanName}`
    if (symbolsWithMembers.has(symbolKey)) continue
    symbolsWithMembers.add(symbolKey)

    for (const memberName of getMemberNames(node)) {
      const memberId = createMemberId(id, memberName)
      memberEntries.push([`${cleanName}.${memberName}`, memberId])
      memberEntries.push([`${cleanName}#${memberName}`, memberId])
    }
  }

  // Flattened namespace elements are also named `Parent.child`, and those are real symbols, so they win.
  for (const [name, memberId] of memberEntries) {
    if (!lookup.has(name)) lookup.set(name, memberId)
  }

  return lookup
}

function getMemberNames(node: DocNode): string[] {
  switch (node.kind) {
    case 'class': {
      const { constructors = [], properties = [], methods = [] } = node.def
      return [
        ...(constructors.length > 0 ? ['constructor'] : []),
        ...properties.map(member => member.name),
        ...methods.map(member => member.name),
      ]
    }
    case 'interface': {
      const { properties = [], methods = [] } = node.def
      return [...properties.map(member => member.name), ...methods.map(member => member.name)]
    }
    case 'enum':
      return getEnumMembers(node).map(member => member.name)
    default:
      return []
  }
}

/**
 * Merge function/method overloads into single entries.
 *
 * TypeScript packages often export many overloads for the same function
 * (e.g., React's `h` has 23 overloads). This groups them together.
 */
export function mergeOverloads(nodes: DocNode[]): MergedSymbol[] {
  const byKey = new Map<string, DocNode[]>()

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
