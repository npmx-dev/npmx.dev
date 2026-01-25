/**
 * API Documentation Generator
 *
 * Generates TypeScript API documentation for npm packages using `deno doc`.
 * Uses esm.sh to resolve package types, which handles @types/* packages automatically.
 *
 * @module server/utils/docs
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { highlightCodeBlock } from './shiki'

const execFileAsync = promisify(execFile)

// =============================================================================
// Configuration
// =============================================================================

/** Timeout for deno doc command in milliseconds (2 minutes) */
const DENO_DOC_TIMEOUT_MS = 2 * 60 * 1000

/** Maximum buffer size for deno doc output (50MB for large packages like React) */
const DENO_DOC_MAX_BUFFER = 50 * 1024 * 1024

/** Maximum number of overload signatures to display per symbol */
const MAX_OVERLOAD_SIGNATURES = 5

/** Maximum number of items to show in TOC per category before truncating */
const MAX_TOC_ITEMS_PER_KIND = 50

/** Order in which symbol kinds are displayed */
const KIND_DISPLAY_ORDER = [
  'function',
  'class',
  'interface',
  'typeAlias',
  'variable',
  'enum',
  'namespace',
] as const

/** Human-readable titles for symbol kinds */
const KIND_TITLES: Record<string, string> = {
  function: 'Functions',
  class: 'Classes',
  interface: 'Interfaces',
  typeAlias: 'Type Aliases',
  variable: 'Variables',
  enum: 'Enums',
  namespace: 'Namespaces',
}

// =============================================================================
// Types - Deno Doc Output
// =============================================================================

/** JSDoc tag from deno doc output */
export interface JsDocTag {
  kind: string
  name?: string
  doc?: string
  optional?: boolean
  type?: string
}

/** TypeScript type representation from deno doc */
export interface TsType {
  repr: string
  kind: string
  keyword?: string
  typeRef?: {
    typeName: string
    typeParams?: TsType[] | null
  }
  array?: TsType
  union?: TsType[]
  literal?: {
    kind: string
    string?: string
    number?: number
    boolean?: boolean
  }
}

/** Function parameter from deno doc */
export interface FunctionParam {
  kind: string
  name: string
  optional?: boolean
  tsType?: TsType
}

/** A documentation node from deno doc output */
export interface DenoDocNode {
  name: string
  kind: string
  isDefault?: boolean
  location?: {
    filename: string
    line: number
    col: number
  }
  declarationKind?: string
  jsDoc?: {
    doc?: string
    tags?: JsDocTag[]
  }
  functionDef?: {
    params?: FunctionParam[]
    returnType?: TsType
    isAsync?: boolean
    isGenerator?: boolean
    typeParams?: Array<{ name: string }>
  }
  classDef?: {
    isAbstract?: boolean
    properties?: Array<{
      name: string
      tsType?: TsType
      readonly?: boolean
      optional?: boolean
      isStatic?: boolean
      jsDoc?: { doc?: string }
    }>
    methods?: Array<{
      name: string
      isStatic?: boolean
      functionDef?: {
        params?: FunctionParam[]
        returnType?: TsType
      }
      jsDoc?: { doc?: string }
    }>
    constructors?: Array<{
      params?: FunctionParam[]
    }>
    extends?: TsType
    implements?: TsType[]
  }
  interfaceDef?: {
    properties?: Array<{
      name: string
      tsType?: TsType
      readonly?: boolean
      optional?: boolean
      jsDoc?: { doc?: string }
    }>
    methods?: Array<{
      name: string
      params?: FunctionParam[]
      returnType?: TsType
      jsDoc?: { doc?: string }
    }>
    extends?: TsType[]
    typeParams?: Array<{ name: string }>
  }
  typeAliasDef?: {
    tsType?: TsType
    typeParams?: Array<{ name: string }>
  }
  variableDef?: {
    tsType?: TsType
    kind?: string
  }
  enumDef?: {
    members?: Array<{ name: string; init?: TsType }>
  }
  namespaceDef?: {
    elements?: DenoDocNode[]
  }
}

/** Raw output from deno doc --json */
interface DenoDocResult {
  version: number
  nodes: DenoDocNode[]
}

/** Result of documentation generation */
export interface DocsGenerationResult {
  html: string
  toc: string | null
  nodes: DenoDocNode[]
}

/** Symbol with merged overloads */
interface MergedSymbol {
  name: string
  kind: string
  nodes: DenoDocNode[]
  jsDoc?: DenoDocNode['jsDoc']
}

/** Map of symbol names to anchor IDs for cross-referencing */
type SymbolLookup = Map<string, string>

// =============================================================================
// Main API
// =============================================================================

/**
 * Generate API documentation for an npm package.
 *
 * Uses `deno doc --json` with esm.sh URLs to extract TypeScript type information
 * and JSDoc comments, then renders them as HTML.
 *
 * @param packageName - The npm package name (e.g., "react", "@types/lodash")
 * @param version - The package version (e.g., "18.2.0")
 * @returns Generated documentation or null if no types are available
 * @throws {Error} If deno is not installed or the command fails
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
  // Verify deno is available
  await verifyDenoInstalled()

  const url = buildEsmShUrl(packageName, version)

  try {
    const result = await runDenoDoc(url)

    if (!result.nodes || result.nodes.length === 0) {
      console.warn(`[docs] No type information found for ${packageName}@${version}`)
      return null
    }

    // Process nodes: flatten namespaces and build lookup
    const flattenedNodes = flattenNamespaces(result.nodes)
    const symbolLookup = buildSymbolLookup(flattenedNodes)

    // Render HTML and TOC
    const html = await renderDocNodes(flattenedNodes, symbolLookup)
    const toc = renderToc(flattenedNodes)

    return { html, toc, nodes: flattenedNodes }
  }
  catch (error) {
    console.error(`[docs] Failed to generate docs for ${packageName}@${version}:`, error)
    throw error
  }
}

// =============================================================================
// Deno Integration
// =============================================================================

let denoChecked = false
let denoAvailable = false

/**
 * Verify that deno is installed and available.
 * @throws {Error} If deno is not installed
 */
async function verifyDenoInstalled(): Promise<void> {
  if (denoChecked) {
    if (!denoAvailable) {
      throw new Error('Deno is not installed. Please install Deno to generate API documentation: https://deno.land')
    }
    return
  }

  try {
    await execFileAsync('deno', ['--version'], { timeout: 5000 })
    denoAvailable = true
  }
  catch {
    denoAvailable = false
    throw new Error('Deno is not installed. Please install Deno to generate API documentation: https://deno.land')
  }
  finally {
    denoChecked = true
  }
}

/**
 * Build esm.sh URL for a package that deno doc can process.
 */
function buildEsmShUrl(packageName: string, version: string): string {
  return `https://esm.sh/${packageName}@${version}?target=deno`
}

/**
 * Run deno doc and parse the JSON output.
 */
async function runDenoDoc(specifier: string): Promise<DenoDocResult> {
  try {
    const { stdout } = await execFileAsync(
      'deno',
      ['doc', '--json', specifier],
      {
        maxBuffer: DENO_DOC_MAX_BUFFER,
        timeout: DENO_DOC_TIMEOUT_MS,
      },
    )

    return JSON.parse(stdout) as DenoDocResult
  }
  catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('ETIMEDOUT') || error.message.includes('timed out')) {
        throw new Error(`Deno doc timed out after ${DENO_DOC_TIMEOUT_MS / 1000}s - package may be too large`)
      }
      throw new Error(`Deno doc failed: ${error.message}`)
    }
    throw new Error('Deno doc failed with unknown error')
  }
}

// =============================================================================
// Node Processing
// =============================================================================

/**
 * Flatten namespace elements into top-level nodes for easier display.
 * Also filters out import/reference nodes that aren't useful for docs.
 */
function flattenNamespaces(nodes: DenoDocNode[]): DenoDocNode[] {
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
function buildSymbolLookup(nodes: DenoDocNode[]): SymbolLookup {
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
function mergeOverloads(nodes: DenoDocNode[]): MergedSymbol[] {
  const byKey = new Map<string, DenoDocNode[]>()

  for (const node of nodes) {
    const cleanName = cleanSymbolName(node.name)
    const key = `${node.kind}:${cleanName}`
    const existing = byKey.get(key)
    if (existing) {
      existing.push(node)
    }
    else {
      byKey.set(key, [node])
    }
  }

  const result: MergedSymbol[] = []

  for (const [, groupedNodes] of byKey) {
    const first = groupedNodes[0]!
    // Use JSDoc from the best-documented overload
    const withDoc = groupedNodes.find(n => n.jsDoc?.doc) || first

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
function groupMergedByKind(symbols: MergedSymbol[]): Record<string, MergedSymbol[]> {
  const grouped: Record<string, MergedSymbol[]> = {}

  for (const sym of symbols) {
    if (!grouped[sym.kind]) {
      grouped[sym.kind] = []
    }
    grouped[sym.kind]!.push(sym)
  }

  return grouped
}

// =============================================================================
// HTML Rendering
// =============================================================================

/**
 * Render all documentation nodes as HTML.
 */
async function renderDocNodes(nodes: DenoDocNode[], symbolLookup: SymbolLookup): Promise<string> {
  const merged = mergeOverloads(nodes)
  const grouped = groupMergedByKind(merged)
  const sections: string[] = []

  for (const kind of KIND_DISPLAY_ORDER) {
    const kindSymbols = grouped[kind]
    if (!kindSymbols || kindSymbols.length === 0) continue

    sections.push(await renderKindSection(kind, kindSymbols, symbolLookup))
  }

  return sections.join('\n')
}

/**
 * Render a section for a specific symbol kind.
 */
async function renderKindSection(
  kind: string,
  symbols: MergedSymbol[],
  symbolLookup: SymbolLookup,
): Promise<string> {
  const title = KIND_TITLES[kind] || kind
  const lines: string[] = []

  lines.push(`<section class="docs-section" id="section-${kind}">`)
  lines.push(`<h2 class="docs-section-title">${title}</h2>`)

  for (const symbol of symbols) {
    lines.push(await renderMergedSymbol(symbol, symbolLookup))
  }

  lines.push(`</section>`)

  return lines.join('\n')
}

/**
 * Render a merged symbol (with all its overloads).
 */
async function renderMergedSymbol(symbol: MergedSymbol, symbolLookup: SymbolLookup): Promise<string> {
  const lines: string[] = []
  const id = createSymbolId(symbol.kind, symbol.name)
  const primaryNode = symbol.nodes[0]!
  const hasOverloads = symbol.nodes.length > 1

  lines.push(`<article class="docs-symbol" id="${id}">`)

  // Header
  lines.push(`<header class="docs-symbol-header">`)
  lines.push(`<a href="#${id}" class="docs-anchor" aria-label="Link to ${escapeHtml(symbol.name)}">#</a>`)
  lines.push(`<h3 class="docs-symbol-name">${escapeHtml(symbol.name)}</h3>`)
  lines.push(`<span class="docs-badge docs-badge--${symbol.kind}">${symbol.kind}</span>`)
  if (primaryNode.functionDef?.isAsync) {
    lines.push(`<span class="docs-badge docs-badge--async">async</span>`)
  }
  if (hasOverloads) {
    lines.push(`<span class="docs-overload-count">${symbol.nodes.length} overloads</span>`)
  }
  lines.push(`</header>`)

  // Signatures
  const signatures = symbol.nodes
    .slice(0, hasOverloads ? MAX_OVERLOAD_SIGNATURES : 1)
    .map(n => getNodeSignature(n))
    .filter(Boolean) as string[]

  if (signatures.length > 0) {
    const signatureCode = signatures.join('\n')
    const highlightedSignature = await highlightCodeBlock(signatureCode, 'typescript')
    lines.push(`<div class="docs-signature">${highlightedSignature}</div>`)

    if (symbol.nodes.length > MAX_OVERLOAD_SIGNATURES) {
      const remaining = symbol.nodes.length - MAX_OVERLOAD_SIGNATURES
      lines.push(`<p class="docs-more-overloads">+ ${remaining} more overloads</p>`)
    }
  }

  // Description
  if (symbol.jsDoc?.doc) {
    const description = symbol.jsDoc.doc.trim()
    lines.push(`<div class="docs-description">${renderMarkdown(description, symbolLookup)}</div>`)
  }

  // JSDoc tags
  if (symbol.jsDoc?.tags && symbol.jsDoc.tags.length > 0) {
    lines.push(await renderJsDocTags(symbol.jsDoc.tags, symbolLookup))
  }

  // Type-specific members
  if (symbol.kind === 'class' && primaryNode.classDef) {
    lines.push(renderClassMembers(primaryNode.classDef))
  }
  else if (symbol.kind === 'interface' && primaryNode.interfaceDef) {
    lines.push(renderInterfaceMembers(primaryNode.interfaceDef))
  }
  else if (symbol.kind === 'enum' && primaryNode.enumDef) {
    lines.push(renderEnumMembers(primaryNode.enumDef))
  }

  lines.push(`</article>`)

  return lines.join('\n')
}

/**
 * Render JSDoc tags (params, returns, examples, etc.)
 */
async function renderJsDocTags(tags: JsDocTag[], symbolLookup: SymbolLookup): Promise<string> {
  const lines: string[] = []

  const params = tags.filter(t => t.kind === 'param')
  const returns = tags.find(t => t.kind === 'return')
  const examples = tags.filter(t => t.kind === 'example')
  const deprecated = tags.find(t => t.kind === 'deprecated')
  const see = tags.filter(t => t.kind === 'see')

  // Deprecated warning
  if (deprecated) {
    lines.push(`<div class="docs-deprecated">`)
    lines.push(`<strong>Deprecated</strong>`)
    if (deprecated.doc) {
      lines.push(`<p>${parseJsDocLinks(deprecated.doc, symbolLookup)}</p>`)
    }
    lines.push(`</div>`)
  }

  // Parameters
  if (params.length > 0) {
    lines.push(`<div class="docs-params">`)
    lines.push(`<h4>Parameters</h4>`)
    lines.push(`<dl>`)
    for (const param of params) {
      lines.push(`<dt><code>${escapeHtml(param.name || '')}${param.optional ? '?' : ''}</code></dt>`)
      if (param.doc) {
        lines.push(`<dd>${parseJsDocLinks(param.doc, symbolLookup)}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  // Returns
  if (returns?.doc) {
    lines.push(`<div class="docs-returns">`)
    lines.push(`<h4>Returns</h4>`)
    lines.push(`<p>${parseJsDocLinks(returns.doc, symbolLookup)}</p>`)
    lines.push(`</div>`)
  }

  // Examples (with syntax highlighting)
  if (examples.length > 0) {
    lines.push(`<div class="docs-examples">`)
    lines.push(`<h4>Example${examples.length > 1 ? 's' : ''}</h4>`)
    for (const example of examples) {
      if (example.doc) {
        const langMatch = example.doc.match(/```(\w+)?/)
        const lang = langMatch?.[1] || 'typescript'
        const code = example.doc.replace(/```\w*\n?/g, '').trim()
        const highlighted = await highlightCodeBlock(code, lang)
        lines.push(highlighted)
      }
    }
    lines.push(`</div>`)
  }

  // See also
  if (see.length > 0) {
    lines.push(`<div class="docs-see">`)
    lines.push(`<h4>See Also</h4>`)
    lines.push(`<ul>`)
    for (const s of see) {
      if (s.doc) {
        lines.push(`<li>${parseJsDocLinks(s.doc, symbolLookup)}</li>`)
      }
    }
    lines.push(`</ul>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

/**
 * Render class members (constructor, properties, methods).
 */
function renderClassMembers(def: NonNullable<DenoDocNode['classDef']>): string {
  const lines: string[] = []
  const { constructors, properties, methods } = def

  if (constructors && constructors.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Constructor</h4>`)
    for (const ctor of constructors) {
      const params = ctor.params?.map(p => formatParam(p)).join(', ') || ''
      lines.push(`<pre><code>constructor(${escapeHtml(params)})</code></pre>`)
    }
    lines.push(`</div>`)
  }

  if (properties && properties.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Properties</h4>`)
    lines.push(`<dl>`)
    for (const prop of properties) {
      const modifiers: string[] = []
      if (prop.isStatic) modifiers.push('static')
      if (prop.readonly) modifiers.push('readonly')
      const modStr = modifiers.length > 0 ? `${modifiers.join(' ')} ` : ''
      const type = formatType(prop.tsType)
      const opt = prop.optional ? '?' : ''
      lines.push(`<dt><code>${escapeHtml(modStr)}${escapeHtml(prop.name)}${opt}: ${escapeHtml(type)}</code></dt>`)
      if (prop.jsDoc?.doc) {
        lines.push(`<dd>${escapeHtml(prop.jsDoc.doc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  if (methods && methods.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Methods</h4>`)
    lines.push(`<dl>`)
    for (const method of methods) {
      const params = method.functionDef?.params?.map(p => formatParam(p)).join(', ') || ''
      const ret = formatType(method.functionDef?.returnType) || 'void'
      const staticStr = method.isStatic ? 'static ' : ''
      lines.push(`<dt><code>${escapeHtml(staticStr)}${escapeHtml(method.name)}(${escapeHtml(params)}): ${escapeHtml(ret)}</code></dt>`)
      if (method.jsDoc?.doc) {
        lines.push(`<dd>${escapeHtml(method.jsDoc.doc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

/**
 * Render interface members (properties, methods).
 */
function renderInterfaceMembers(def: NonNullable<DenoDocNode['interfaceDef']>): string {
  const lines: string[] = []
  const { properties, methods } = def

  if (properties && properties.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Properties</h4>`)
    lines.push(`<dl>`)
    for (const prop of properties) {
      const type = formatType(prop.tsType)
      const opt = prop.optional ? '?' : ''
      const ro = prop.readonly ? 'readonly ' : ''
      lines.push(`<dt><code>${escapeHtml(ro)}${escapeHtml(prop.name)}${opt}: ${escapeHtml(type)}</code></dt>`)
      if (prop.jsDoc?.doc) {
        lines.push(`<dd>${escapeHtml(prop.jsDoc.doc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  if (methods && methods.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Methods</h4>`)
    lines.push(`<dl>`)
    for (const method of methods) {
      const params = method.params?.map(p => formatParam(p)).join(', ') || ''
      const ret = formatType(method.returnType) || 'void'
      lines.push(`<dt><code>${escapeHtml(method.name)}(${escapeHtml(params)}): ${escapeHtml(ret)}</code></dt>`)
      if (method.jsDoc?.doc) {
        lines.push(`<dd>${escapeHtml(method.jsDoc.doc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

/**
 * Render enum members.
 */
function renderEnumMembers(def: NonNullable<DenoDocNode['enumDef']>): string {
  const lines: string[] = []
  const { members } = def

  if (members && members.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Members</h4>`)
    lines.push(`<ul class="docs-enum-members">`)
    for (const member of members) {
      lines.push(`<li><code>${escapeHtml(member.name)}</code></li>`)
    }
    lines.push(`</ul>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

/**
 * Render table of contents.
 */
function renderToc(nodes: DenoDocNode[]): string {
  const merged = mergeOverloads(nodes)
  const grouped = groupMergedByKind(merged)
  const lines: string[] = []

  lines.push(`<nav class="toc text-sm">`)
  lines.push(`<ul class="space-y-3">`)

  for (const kind of KIND_DISPLAY_ORDER) {
    const kindSymbols = grouped[kind]
    if (!kindSymbols || kindSymbols.length === 0) continue

    const title = KIND_TITLES[kind] || kind
    lines.push(`<li>`)
    lines.push(`<a href="#section-${kind}" class="font-semibold text-fg-muted hover:text-fg block mb-1">${title} <span class="text-fg-subtle font-normal">(${kindSymbols.length})</span></a>`)

    const showSymbols = kindSymbols.slice(0, MAX_TOC_ITEMS_PER_KIND)
    lines.push(`<ul class="pl-3 space-y-0.5 border-l border-border/50">`)
    for (const symbol of showSymbols) {
      const id = createSymbolId(symbol.kind, symbol.name)
      lines.push(`<li><a href="#${id}" class="text-fg-subtle hover:text-fg font-mono text-xs block py-0.5 truncate">${escapeHtml(symbol.name)}</a></li>`)
    }
    if (kindSymbols.length > MAX_TOC_ITEMS_PER_KIND) {
      const remaining = kindSymbols.length - MAX_TOC_ITEMS_PER_KIND
      lines.push(`<li class="text-fg-subtle text-xs py-0.5">... and ${remaining} more</li>`)
    }
    lines.push(`</ul>`)

    lines.push(`</li>`)
  }

  lines.push(`</ul>`)
  lines.push(`</nav>`)

  return lines.join('\n')
}

// =============================================================================
// Signature Formatting
// =============================================================================

/**
 * Generate a TypeScript signature string for a node.
 */
function getNodeSignature(node: DenoDocNode): string | null {
  const name = cleanSymbolName(node.name)

  switch (node.kind) {
    case 'function': {
      const typeParams = node.functionDef?.typeParams?.map(t => t.name).join(', ')
      const typeParamsStr = typeParams ? `<${typeParams}>` : ''
      const params = node.functionDef?.params?.map(p => formatParam(p)).join(', ') || ''
      const ret = formatType(node.functionDef?.returnType) || 'void'
      const asyncStr = node.functionDef?.isAsync ? 'async ' : ''
      return `${asyncStr}function ${name}${typeParamsStr}(${params}): ${ret}`
    }
    case 'class': {
      const ext = node.classDef?.extends ? ` extends ${formatType(node.classDef.extends)}` : ''
      const impl = node.classDef?.implements?.map(t => formatType(t)).join(', ')
      const implStr = impl ? ` implements ${impl}` : ''
      const abstractStr = node.classDef?.isAbstract ? 'abstract ' : ''
      return `${abstractStr}class ${name}${ext}${implStr}`
    }
    case 'interface': {
      const typeParams = node.interfaceDef?.typeParams?.map(t => t.name).join(', ')
      const typeParamsStr = typeParams ? `<${typeParams}>` : ''
      const ext = node.interfaceDef?.extends?.map(t => formatType(t)).join(', ')
      const extStr = ext ? ` extends ${ext}` : ''
      return `interface ${name}${typeParamsStr}${extStr}`
    }
    case 'typeAlias': {
      const typeParams = node.typeAliasDef?.typeParams?.map(t => t.name).join(', ')
      const typeParamsStr = typeParams ? `<${typeParams}>` : ''
      const type = formatType(node.typeAliasDef?.tsType) || 'unknown'
      return `type ${name}${typeParamsStr} = ${type}`
    }
    case 'variable': {
      const keyword = node.variableDef?.kind === 'const' ? 'const' : 'let'
      const type = formatType(node.variableDef?.tsType) || 'unknown'
      return `${keyword} ${name}: ${type}`
    }
    case 'enum': {
      return `enum ${name}`
    }
    default:
      return null
  }
}

/**
 * Format a function parameter.
 */
function formatParam(param: FunctionParam): string {
  const optional = param.optional ? '?' : ''
  const type = formatType(param.tsType)
  return type ? `${param.name}${optional}: ${type}` : `${param.name}${optional}`
}

/**
 * Format a TypeScript type.
 */
function formatType(type?: TsType): string {
  if (!type) return ''

  if (type.repr) return type.repr

  if (type.kind === 'keyword' && type.keyword) {
    return type.keyword
  }

  if (type.kind === 'typeRef' && type.typeRef) {
    const params = type.typeRef.typeParams?.map(t => formatType(t)).join(', ')
    return params ? `${type.typeRef.typeName}<${params}>` : type.typeRef.typeName
  }

  if (type.kind === 'array' && type.array) {
    return `${formatType(type.array)}[]`
  }

  if (type.kind === 'union' && type.union) {
    return type.union.map(t => formatType(t)).join(' | ')
  }

  return type.repr || 'unknown'
}

// =============================================================================
// Text Processing Utilities
// =============================================================================

/**
 * Clean up symbol names by stripping esm.sh prefixes.
 *
 * Packages using @types/* definitions get "default." or "default_" prefixes
 * from esm.sh that we need to remove for clean display.
 */
function cleanSymbolName(name: string): string {
  if (name.startsWith('default.')) {
    return name.slice(8)
  }
  if (name.startsWith('default_')) {
    return name.slice(8)
  }
  return name
}

/**
 * Create a URL-safe HTML anchor ID for a symbol.
 */
function createSymbolId(kind: string, name: string): string {
  return `${kind}-${name}`.replace(/[^a-zA-Z0-9-]/g, '_')
}

/**
 * Parse JSDoc {@link} tags into HTML links.
 *
 * Handles:
 * - {@link https://example.com} - external URL
 * - {@link https://example.com Link Text} - external URL with label
 * - {@link SomeSymbol} - internal cross-reference
 */
function parseJsDocLinks(text: string, symbolLookup: SymbolLookup): string {
  let result = escapeHtml(text)

  result = result.replace(/\{@link\s+([^\s}]+)(?:\s+([^}]+))?\}/g, (_, target, label) => {
    const displayText = label || target

    // External URL
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return `<a href="${target}" target="_blank" rel="noopener" class="docs-link">${displayText}</a>`
    }

    // Internal symbol reference
    const symbolId = symbolLookup.get(target)
    if (symbolId) {
      return `<a href="#${symbolId}" class="docs-symbol-link">${displayText}</a>`
    }

    // Unknown symbol
    return `<code class="docs-symbol-ref">${displayText}</code>`
  })

  return result
}

/**
 * Render simple markdown-like formatting.
 */
function renderMarkdown(text: string, symbolLookup: SymbolLookup): string {
  let result = parseJsDocLinks(text, symbolLookup)

  result = result
    .replace(/`([^`]+)`/g, '<code class="docs-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br>')

  return result
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
