/**
 * Markdown Rendering
 *
 * Functions for rendering documentation nodes as Markdown, so the generated
 * API docs can be copied and pasted elsewhere (READMEs, issues, LLM prompts, ...).
 *
 * @module server/utils/docs/markdown
 */

import type { DenoDocNode, JsDocTag } from '#shared/types/deno-doc'
import {
  formatClassGetterSignature,
  formatClassMethodSignature,
  formatClassPropertySignature,
  formatConstructorSignature,
  formatInterfaceMethodSignature,
  formatInterfacePropertySignature,
  getNodeSignature,
} from './format'
import { groupMergedByKind } from './processing'
import { KIND_DISPLAY_ORDER, KIND_TITLES, MAX_OVERLOAD_SIGNATURES } from './render'
import type { MergedSymbol, ProcessedEntry } from './types'

/**
 * Wrap code in a fenced code block.
 */
function fenceCode(code: string, lang = 'ts'): string {
  return `\`\`\`${lang}\n${code}\n\`\`\``
}

/**
 * Wrap text in an inline code span, using a delimiter longer than any backtick run inside the text.
 */
function inlineCode(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map(run => run.length))
  if (longestRun === 0) return `\`${text}\``
  const delimiter = '`'.repeat(longestRun + 1)
  return `${delimiter} ${text} ${delimiter}`
}

/**
 * Convert JSDoc {@link} tags into Markdown.
 *
 * External URLs become Markdown links, references to symbols become inline code
 * (the Markdown output has no anchors to link to).
 *
 * @internal Exported for testing
 */
export function convertJsDocLinks(text: string): string {
  return text.replace(
    /\{@link\s+([^\s|}]+)(?:(?:\s*\||\s)([^}]*))?\}/g,
    (_, target: string, label: string | undefined) => {
      const displayText = label?.trim() || target
      if (target.startsWith('http://') || target.startsWith('https://')) {
        return `[${displayText}](${target})`
      }
      return inlineCode(displayText)
    },
  )
}

type MemberItem = { signature: string; description?: string }

/**
 * Render a bulleted list of members. Like the HTML docs, only the first line of
 * a member's JSDoc is shown.
 */
function renderMemberList(title: string, items: MemberItem[]): string | null {
  if (items.length === 0) return null

  const lines = items.map(({ signature, description }) => {
    const doc = convertJsDocLinks(description?.split('\n')[0] ?? '').trim()
    return doc ? `- ${inlineCode(signature)} - ${doc}` : `- ${inlineCode(signature)}`
  })

  return [`**${title}**`, '', ...lines].join('\n')
}

function renderClassMembers(def: NonNullable<DenoDocNode['classDef']>): Array<string | null> {
  const { constructors, properties, methods } = def
  const getters = methods?.filter(m => m.kind === 'getter') ?? []
  const regularMethods = methods?.filter(m => m.kind !== 'getter') ?? []

  return [
    renderMemberList(
      'Constructor',
      (constructors ?? []).map(ctor => ({ signature: formatConstructorSignature(ctor) })),
    ),
    renderMemberList(
      'Properties',
      (properties ?? []).map(prop => ({
        signature: formatClassPropertySignature(prop),
        description: prop.jsDoc?.doc,
      })),
    ),
    renderMemberList(
      'Getters',
      getters.map(getter => ({
        signature: formatClassGetterSignature(getter),
        description: getter.jsDoc?.doc,
      })),
    ),
    renderMemberList(
      'Methods',
      regularMethods.map(method => ({
        signature: formatClassMethodSignature(method),
        description: method.jsDoc?.doc,
      })),
    ),
  ]
}

function renderInterfaceMembers(
  def: NonNullable<DenoDocNode['interfaceDef']>,
): Array<string | null> {
  return [
    renderMemberList(
      'Properties',
      (def.properties ?? []).map(prop => ({
        signature: formatInterfacePropertySignature(prop),
        description: prop.jsDoc?.doc,
      })),
    ),
    renderMemberList(
      'Methods',
      (def.methods ?? []).map(method => ({
        signature: formatInterfaceMethodSignature(method),
        description: method.jsDoc?.doc,
      })),
    ),
  ]
}

function renderEnumMembers(def: NonNullable<DenoDocNode['enumDef']>): Array<string | null> {
  return [
    renderMemberList(
      'Members',
      (def.members ?? []).map(member => ({ signature: member.name })),
    ),
  ]
}

/**
 * Render JSDoc tags (deprecated, params, returns, examples, see) as Markdown sections.
 */
function renderJsDocTags(tags: JsDocTag[]): string[] {
  const sections: string[] = []

  const params = tags.filter(t => t.kind === 'param')
  const returns = tags.find(t => t.kind === 'return')
  const examples = tags.filter(t => t.kind === 'example')
  const deprecated = tags.find(t => t.kind === 'deprecated')
  const see = tags.filter(t => t.kind === 'see')

  if (deprecated) {
    const message = deprecated.doc?.replace(/\s*\n\s*/g, ' ').trim()
    sections.push(`> **Deprecated**${message ? `: ${convertJsDocLinks(message)}` : ''}`)
  }

  if (params.length > 0) {
    const items = params.map(param => {
      const name = inlineCode(`${param.name || ''}${param.optional ? '?' : ''}`)
      // TSDoc writes `@param name - description`; the hyphen is already supplied by the list item.
      const doc = param.doc ? convertJsDocLinks(param.doc.trim().replace(/^-\s+/, '')) : ''
      return doc ? `- ${name} - ${doc}` : `- ${name}`
    })
    sections.push(['**Parameters**', '', ...items].join('\n'))
  }

  if (returns?.doc) {
    sections.push(`**Returns**\n\n${convertJsDocLinks(returns.doc.trim())}`)
  }

  const renderedExamples = examples.flatMap(example => {
    if (!example.doc) return []
    const lang = example.doc.match(/```[ \t]*([-\w]+)?/)?.[1] || 'ts'
    const code = example.doc.replace(/```[ \t]*[-\w]*[ \t]*(?:\r\n|\r|\n)?/g, '').trim()
    return [fenceCode(code, lang)]
  })
  if (renderedExamples.length > 0) {
    sections.push(
      [`**Example${renderedExamples.length > 1 ? 's' : ''}**`, ...renderedExamples].join('\n\n'),
    )
  }

  const seeItems = see.flatMap(s => (s.doc ? [`- ${convertJsDocLinks(s.doc.trim())}`] : []))
  if (seeItems.length > 0) {
    sections.push(['**See also**', '', ...seeItems].join('\n'))
  }

  return sections
}

function renderSymbol(symbol: MergedSymbol, headingLevel: number): string | null {
  const primaryNode = symbol.nodes[0]
  if (!primaryNode) return null

  const sections: Array<string | null> = [`${'#'.repeat(headingLevel)} ${inlineCode(symbol.name)}`]

  const hasOverloads = symbol.nodes.length > 1
  const signatures = symbol.nodes
    .slice(0, hasOverloads ? MAX_OVERLOAD_SIGNATURES : 1)
    .map(node => getNodeSignature(node))
    .filter(signature => signature !== null)
  if (signatures.length > 0) {
    sections.push(fenceCode(signatures.join('\n')))
    if (symbol.nodes.length > MAX_OVERLOAD_SIGNATURES) {
      sections.push(`_+ ${symbol.nodes.length - MAX_OVERLOAD_SIGNATURES} more overloads_`)
    }
  }

  const description = symbol.jsDoc?.doc?.trim()
  if (description) {
    sections.push(convertJsDocLinks(description))
  }

  if (symbol.jsDoc?.tags) {
    sections.push(...renderJsDocTags(symbol.jsDoc.tags))
  }

  if (symbol.kind === 'class' && primaryNode.classDef) {
    sections.push(...renderClassMembers(primaryNode.classDef))
  } else if (symbol.kind === 'interface' && primaryNode.interfaceDef) {
    sections.push(...renderInterfaceMembers(primaryNode.interfaceDef))
  } else if (symbol.kind === 'enum' && primaryNode.enumDef) {
    sections.push(...renderEnumMembers(primaryNode.enumDef))
  }

  return sections.filter(section => section !== null).join('\n\n')
}

/**
 * Render symbols grouped by kind (Functions, Classes, ...) as Markdown sections.
 */
function renderSymbols(symbols: MergedSymbol[], kindHeadingLevel: number): string[] {
  const grouped = groupMergedByKind(symbols)
  const sections: string[] = []

  for (const kind of KIND_DISPLAY_ORDER) {
    const kindSymbols = grouped[kind]
    if (!kindSymbols || kindSymbols.length === 0) continue

    sections.push(`${'#'.repeat(kindHeadingLevel)} ${KIND_TITLES[kind] || kind}`)
    for (const symbol of kindSymbols) {
      const rendered = renderSymbol(symbol, kindHeadingLevel + 1)
      if (rendered) sections.push(rendered)
    }
  }

  return sections
}

/**
 * Render a package's API documentation as a single Markdown document.
 *
 * Entry points with a prefix get their own section, mirroring the HTML docs; a lone entry,
 * or the root export of a multi-entry package, is rendered flat.
 */
export function renderEntriesMarkdown(packageName: string, entries: ProcessedEntry[]): string {
  const sections: string[] = [`# ${inlineCode(packageName)}`]

  for (const entry of entries) {
    if (entry.prefix) {
      sections.push(`## ${inlineCode(entry.entryPoint.replace(/^\.\//, ''))}`)
      sections.push(...renderSymbols(entry.symbols, 3))
    } else {
      sections.push(...renderSymbols(entry.symbols, 2))
    }
  }

  return `${sections.join('\n\n')}\n`
}
