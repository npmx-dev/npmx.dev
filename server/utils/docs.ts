import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { highlightCodeBlock } from './shiki'

const execFileAsync = promisify(execFile)

// More complete type definitions based on actual deno doc output
export interface JsDocTag {
  kind: string
  name?: string
  doc?: string
  optional?: boolean
  type?: string
}

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

export interface FunctionParam {
  kind: string
  name: string
  optional?: boolean
  tsType?: TsType
}

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

export interface DenoDocResult {
  version: number
  nodes: DenoDocNode[]
}

export interface DenoDocsGenerationResult {
  html: string
  toc: string | null
  nodes: DenoDocNode[]
}

/**
 * Generate documentation for an npm package using `deno doc --json` via esm.sh
 */
export async function generateDocsWithDeno(
  packageName: string,
  version: string,
): Promise<DenoDocsGenerationResult | null> {
  const url = buildEsmShUrl(packageName, version)

  try {
    const result = await runDenoDoc(url)

    if (!result.nodes || result.nodes.length === 0) {
      console.warn(`[docs-deno] no nodes found for ${packageName}@${version}`)
      return null
    }

    // Flatten namespace elements for better display
    const flattenedNodes = flattenNamespaces(result.nodes)

    // Build symbol lookup for cross-references
    const symbolLookup = buildSymbolLookup(flattenedNodes)

    const html = await renderDocNodes(flattenedNodes, packageName, version, symbolLookup)
    const toc = renderToc(flattenedNodes)

    return { html, toc, nodes: flattenedNodes }
  }
  catch (error) {
    console.error(`[docs-deno] failed to generate docs for ${packageName}@${version}`, error)
    throw error
  }
}

function buildEsmShUrl(packageName: string, version: string): string {
  return `https://esm.sh/${packageName}@${version}?target=deno`
}

async function runDenoDoc(specifier: string): Promise<DenoDocResult> {
  try {
    const { stdout } = await execFileAsync('deno', ['doc', '--json', specifier], {
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large packages
    })

    const result = JSON.parse(stdout) as DenoDocResult
    return result
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`deno doc failed: ${message}`)
  }
}

function flattenNamespaces(nodes: DenoDocNode[]): DenoDocNode[] {
  const result: DenoDocNode[] = []

  for (const node of nodes) {
    // Skip import and reference nodes
    if (node.kind === 'import' || node.kind === 'reference') {
      continue
    }

    result.push(node)

    // Flatten namespace elements
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

// Merged symbol with all overloads combined
export interface MergedSymbol {
  name: string
  kind: string
  nodes: DenoDocNode[]
  // Combined jsDoc from the node that has the best documentation
  jsDoc?: DenoDocNode['jsDoc']
}

// Map of symbol names to their IDs for cross-referencing
type SymbolLookup = Map<string, string>

/**
 * Build a lookup table of symbol names to their anchor IDs
 */
function buildSymbolLookup(nodes: DenoDocNode[]): SymbolLookup {
  const lookup = new Map<string, string>()

  for (const node of nodes) {
    const cleanName = cleanSymbolName(node.name)
    const id = `${node.kind}-${cleanName}`.replace(/[^a-zA-Z0-9-]/g, '_')
    lookup.set(cleanName, id)
  }

  return lookup
}

/**
 * Clean up symbol names - strip `default.` prefix that esm.sh adds
 * for packages using @types/* definitions
 */
function cleanSymbolName(name: string): string {
  // Strip "default." prefix (e.g., "default.useState" -> "useState")
  if (name.startsWith('default.')) {
    return name.slice(8)
  }
  // Strip "default_" prefix (alternative format)
  if (name.startsWith('default_')) {
    return name.slice(8)
  }
  return name
}

/**
 * Parse JSDoc {@link} tags into actual HTML links
 * Handles: {@link URL}, {@link URL text}, {@link symbol}
 */
function parseJsDocLinks(text: string, symbolLookup: SymbolLookup): string {
  // First escape HTML, then process {@link} tags
  let result = escapeHtml(text)

  // Match {@link URL} or {@link URL text} or {@link symbol}
  result = result.replace(/\{@link\s+([^\s}]+)(?:\s+([^}]+))?\}/g, (_, target, label) => {
    const displayText = label || target
    // Check if it's a URL
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return `<a href="${target}" target="_blank" rel="noopener" class="docs-link">${displayText}</a>`
    }
    // Check if it's a known symbol we can link to
    const symbolId = symbolLookup.get(target)
    if (symbolId) {
      return `<a href="#${symbolId}" class="docs-symbol-link">${displayText}</a>`
    }
    // Unknown symbol - display as code
    return `<code class="docs-symbol-ref">${displayText}</code>`
  })

  return result
}

/**
 * Merge function/method overloads into single entries.
 * TypeScript packages often export many overloads for the same function.
 */
function mergeOverloads(nodes: DenoDocNode[]): MergedSymbol[] {
  const byKey = new Map<string, DenoDocNode[]>()

  for (const node of nodes) {
    // Clean the name before using as key
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
    // Find the node with the best documentation
    const withDoc = groupedNodes.find(n => n.jsDoc?.doc) || first

    result.push({
      name: cleanSymbolName(first.name),
      kind: first.kind,
      nodes: groupedNodes,
      jsDoc: withDoc.jsDoc,
    })
  }

  // Sort by name
  result.sort((a, b) => a.name.localeCompare(b.name))

  return result
}

async function renderDocNodes(nodes: DenoDocNode[], _packageName: string, _version: string, symbolLookup: SymbolLookup): Promise<string> {
  // Merge overloads before grouping
  const merged = mergeOverloads(nodes)
  const grouped = groupMergedByKind(merged)
  const sections: string[] = []

  const kindOrder = ['function', 'class', 'interface', 'typeAlias', 'variable', 'enum', 'namespace']

  for (const kind of kindOrder) {
    const kindSymbols = grouped[kind]
    if (!kindSymbols || kindSymbols.length === 0) continue

    sections.push(await renderKindSection(kind, kindSymbols, symbolLookup))
  }

  return sections.join('\n')
}

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

async function renderKindSection(kind: string, symbols: MergedSymbol[], symbolLookup: SymbolLookup): Promise<string> {
  const title = getKindTitle(kind)
  const lines: string[] = []

  lines.push(`<section class="docs-section" id="section-${kind}">`)
  lines.push(`<h2 class="docs-section-title">${title}</h2>`)

  for (const symbol of symbols) {
    lines.push(await renderMergedSymbol(symbol, symbolLookup))
  }

  lines.push(`</section>`)

  return lines.join('\n')
}

function getKindTitle(kind: string): string {
  const titles: Record<string, string> = {
    function: 'Functions',
    class: 'Classes',
    interface: 'Interfaces',
    typeAlias: 'Type Aliases',
    variable: 'Variables',
    enum: 'Enums',
    namespace: 'Namespaces',
  }
  return titles[kind] || kind
}

function getSymbolId(symbol: MergedSymbol): string {
  return `${symbol.kind}-${symbol.name}`.replace(/[^a-zA-Z0-9-]/g, '_')
}

async function renderMergedSymbol(symbol: MergedSymbol, symbolLookup: SymbolLookup): Promise<string> {
  const lines: string[] = []
  const id = getSymbolId(symbol)
  const primaryNode = symbol.nodes[0]!
  const hasOverloads = symbol.nodes.length > 1

  lines.push(`<article class="docs-symbol" id="${id}">`)

  // Header with name and kind badge
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

  // Signatures - show all overloads (limit to prevent huge blocks)
  const maxSignatures = hasOverloads ? 5 : 1
  const signatures = symbol.nodes.slice(0, maxSignatures).map(n => getNodeSignature(n)).filter(Boolean)
  const hasMore = symbol.nodes.length > maxSignatures

  if (signatures.length > 0) {
    // Highlight signatures as TypeScript
    const signatureCode = signatures.map(s => s!).join('\n')
    const highlightedSignature = await highlightCodeBlock(signatureCode, 'typescript')
    lines.push(`<div class="docs-signature">${highlightedSignature}</div>`)
    if (hasMore) {
      lines.push(`<p class="docs-more-overloads">+ ${symbol.nodes.length - maxSignatures} more overloads</p>`)
    }
  }

  // JSDoc description (from best documented node)
  if (symbol.jsDoc?.doc) {
    const description = symbol.jsDoc.doc.trim()
    lines.push(`<div class="docs-description">${renderMarkdown(description, symbolLookup)}</div>`)
  }

  // JSDoc tags (params, returns, examples)
  if (symbol.jsDoc?.tags && symbol.jsDoc.tags.length > 0) {
    lines.push(await renderJsDocTags(symbol.jsDoc.tags, symbolLookup))
  }

  // Members for classes/interfaces (use primary node)
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

function formatParam(param: FunctionParam): string {
  const optional = param.optional ? '?' : ''
  const type = formatType(param.tsType)
  return type ? `${param.name}${optional}: ${type}` : `${param.name}${optional}`
}

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

  // Return
  if (returns?.doc) {
    lines.push(`<div class="docs-returns">`)
    lines.push(`<h4>Returns</h4>`)
    lines.push(`<p>${parseJsDocLinks(returns.doc, symbolLookup)}</p>`)
    lines.push(`</div>`)
  }

  // Examples - use Shiki for syntax highlighting
  if (examples.length > 0) {
    lines.push(`<div class="docs-examples">`)
    lines.push(`<h4>Example${examples.length > 1 ? 's' : ''}</h4>`)
    for (const example of examples) {
      if (example.doc) {
        // Extract language and code from markdown code blocks
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
        // Parse {@link} tags
        lines.push(`<li>${parseJsDocLinks(s.doc, symbolLookup)}</li>`)
      }
    }
    lines.push(`</ul>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

function renderClassMembers(def: NonNullable<DenoDocNode['classDef']>): string {
  const lines: string[] = []
  const { constructors, properties, methods } = def

  // Constructors
  if (constructors && constructors.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Constructor</h4>`)
    for (const ctor of constructors) {
      const params = ctor.params?.map(p => formatParam(p)).join(', ') || ''
      lines.push(`<pre><code>constructor(${escapeHtml(params)})</code></pre>`)
    }
    lines.push(`</div>`)
  }

  // Properties
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
      const propDoc = prop.jsDoc?.doc
      if (propDoc) {
        lines.push(`<dd>${escapeHtml(propDoc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  // Methods
  if (methods && methods.length > 0) {
    lines.push(`<div class="docs-members">`)
    lines.push(`<h4>Methods</h4>`)
    lines.push(`<dl>`)
    for (const method of methods) {
      const params = method.functionDef?.params?.map(p => formatParam(p)).join(', ') || ''
      const ret = formatType(method.functionDef?.returnType) || 'void'
      const staticStr = method.isStatic ? 'static ' : ''
      lines.push(`<dt><code>${escapeHtml(staticStr)}${escapeHtml(method.name)}(${escapeHtml(params)}): ${escapeHtml(ret)}</code></dt>`)
      const methodDoc = method.jsDoc?.doc
      if (methodDoc) {
        lines.push(`<dd>${escapeHtml(methodDoc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

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
      const propDoc = prop.jsDoc?.doc
      if (propDoc) {
        lines.push(`<dd>${escapeHtml(propDoc.split('\n')[0] ?? '')}</dd>`)
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
      const methodDoc = method.jsDoc?.doc
      if (methodDoc) {
        lines.push(`<dd>${escapeHtml(methodDoc.split('\n')[0] ?? '')}</dd>`)
      }
    }
    lines.push(`</dl>`)
    lines.push(`</div>`)
  }

  return lines.join('\n')
}

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

function renderToc(nodes: DenoDocNode[]): string {
  // Use merged symbols for TOC to avoid duplicates
  const merged = mergeOverloads(nodes)
  const grouped = groupMergedByKind(merged)
  const lines: string[] = []

  lines.push(`<nav class="toc text-sm">`)
  lines.push(`<ul class="space-y-3">`)

  const kindOrder = ['function', 'class', 'interface', 'typeAlias', 'variable', 'enum', 'namespace']

  for (const kind of kindOrder) {
    const kindSymbols = grouped[kind]
    if (!kindSymbols || kindSymbols.length === 0) continue

    const title = getKindTitle(kind)
    lines.push(`<li>`)
    lines.push(`<a href="#section-${kind}" class="font-semibold text-fg-muted hover:text-fg block mb-1">${title} <span class="text-fg-subtle font-normal">(${kindSymbols.length})</span></a>`)

    // Always show TOC items, but limit to prevent huge lists
    const maxItems = 50
    const showSymbols = kindSymbols.slice(0, maxItems)
    lines.push(`<ul class="pl-3 space-y-0.5 border-l border-border/50">`)
    for (const symbol of showSymbols) {
      const id = getSymbolId(symbol)
      lines.push(`<li><a href="#${id}" class="text-fg-subtle hover:text-fg font-mono text-xs block py-0.5 truncate">${escapeHtml(symbol.name)}</a></li>`)
    }
    if (kindSymbols.length > maxItems) {
      lines.push(`<li class="text-fg-subtle text-xs py-0.5">... and ${kindSymbols.length - maxItems} more</li>`)
    }
    lines.push(`</ul>`)

    lines.push(`</li>`)
  }

  lines.push(`</ul>`)
  lines.push(`</nav>`)

  return lines.join('\n')
}

function renderMarkdown(text: string, symbolLookup: SymbolLookup): string {
  // First parse {@link} tags (this also escapes HTML)
  let result = parseJsDocLinks(text, symbolLookup)

  // Then apply markdown formatting
  result = result
    .replace(/`([^`]+)`/g, '<code class="docs-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br>')

  return result
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
