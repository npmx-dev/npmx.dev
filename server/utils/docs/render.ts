/**
 * HTML Rendering
 *
 * Functions for rendering documentation nodes as HTML.
 *
 * @module server/utils/docs/render
 */

import type { DenoDocNode, JsDocTag } from '#shared/types/deno-doc'
import { highlightCodeBlock } from '../shiki'
import { formatParam, formatType, getNodeSignature } from './format'
import { groupMergedByKind } from './processing'
import { createSymbolId, escapeHtml, parseJsDocLinks, renderMarkdown } from './text'
import type { MergedSymbol, SymbolLookup } from './types'

// =============================================================================
// Configuration
// =============================================================================

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
// Main Rendering Functions
// =============================================================================

/**
 * Render all documentation nodes as HTML.
 */
export async function renderDocNodes(
  symbols: MergedSymbol[],
  symbolLookup: SymbolLookup,
): Promise<string> {
  const grouped = groupMergedByKind(symbols)
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
async function renderMergedSymbol(
  symbol: MergedSymbol,
  symbolLookup: SymbolLookup,
): Promise<string> {
  const primaryNode = symbol.nodes[0]
  if (!primaryNode) return '' // Safety check - should never happen

  const lines: string[] = []
  const id = createSymbolId(symbol.kind, symbol.name)
  const hasOverloads = symbol.nodes.length > 1

  lines.push(`<article class="docs-symbol" id="${id}">`)

  // Header
  lines.push(`<header class="docs-symbol-header">`)
  lines.push(
    `<a href="#${id}" class="docs-anchor" aria-label="Link to ${escapeHtml(symbol.name)}">#</a>`,
  )
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
  } else if (symbol.kind === 'interface' && primaryNode.interfaceDef) {
    lines.push(renderInterfaceMembers(primaryNode.interfaceDef))
  } else if (symbol.kind === 'enum' && primaryNode.enumDef) {
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
      lines.push(
        `<dt><code>${escapeHtml(param.name || '')}${param.optional ? '?' : ''}</code></dt>`,
      )
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

// =============================================================================
// Member Rendering
// =============================================================================

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
      lines.push(
        `<dt><code>${escapeHtml(modStr)}${escapeHtml(prop.name)}${opt}: ${escapeHtml(type)}</code></dt>`,
      )
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
      lines.push(
        `<dt><code>${escapeHtml(staticStr)}${escapeHtml(method.name)}(${escapeHtml(params)}): ${escapeHtml(ret)}</code></dt>`,
      )
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
      lines.push(
        `<dt><code>${escapeHtml(ro)}${escapeHtml(prop.name)}${opt}: ${escapeHtml(type)}</code></dt>`,
      )
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
      lines.push(
        `<dt><code>${escapeHtml(method.name)}(${escapeHtml(params)}): ${escapeHtml(ret)}</code></dt>`,
      )
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

// =============================================================================
// Table of Contents
// =============================================================================

/**
 * Render table of contents.
 */
export function renderToc(symbols: MergedSymbol[]): string {
  const grouped = groupMergedByKind(symbols)
  const lines: string[] = []

  lines.push(`<nav class="toc text-sm" aria-label="Table of contents">`)
  lines.push(`<ul class="space-y-3">`)

  for (const kind of KIND_DISPLAY_ORDER) {
    const kindSymbols = grouped[kind]
    if (!kindSymbols || kindSymbols.length === 0) continue

    const title = KIND_TITLES[kind] || kind
    lines.push(`<li>`)
    lines.push(
      `<a href="#section-${kind}" class="font-semibold text-fg-muted hover:text-fg block mb-1">${title} <span class="text-fg-subtle font-normal">(${kindSymbols.length})</span></a>`,
    )

    const showSymbols = kindSymbols.slice(0, MAX_TOC_ITEMS_PER_KIND)
    lines.push(`<ul class="pl-3 space-y-0.5 border-l border-border/50">`)
    for (const symbol of showSymbols) {
      const id = createSymbolId(symbol.kind, symbol.name)
      lines.push(
        `<li><a href="#${id}" class="text-fg-subtle hover:text-fg font-mono text-xs block py-0.5 truncate">${escapeHtml(symbol.name)}</a></li>`,
      )
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
