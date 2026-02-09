/* oxlint-disable regexp/no-super-linear-backtracking */
/**
 * Text Processing Utilities
 *
 * Functions for escaping HTML, parsing JSDoc links, and rendering markdown.
 *
 * @module server/utils/docs/text
 */

import { highlightCodeBlock } from '../shiki'
import type { SymbolLookup } from './types'

/**
 * Strip ANSI escape codes from text.
 * Deno doc output may contain terminal color codes that need to be removed.
 */
const ESC = String.fromCharCode(27)
const ANSI_PATTERN = new RegExp(`${ESC}\\[[0-9;]*m`, 'g')

export function stripAnsi(text: string): string {
  return text.replace(ANSI_PATTERN, '')
}

/**
 * Escape HTML special characters.
 *
 * @internal Exported for testing
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Clean up symbol names by stripping esm.sh prefixes.
 *
 * Packages using @types/* definitions get "default." or "default_" prefixes
 * from esm.sh that we need to remove for clean display.
 */
export function cleanSymbolName(name: string): string {
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
export function createSymbolId(kind: string, name: string): string {
  return `${kind}-${name}`.replace(/[^a-z0-9-]/gi, '_')
}

/**
 * Parse JSDoc {@link} tags into HTML links.
 *
 * Handles:
 * - {@link https://example.com} - external URL
 * - {@link https://example.com Link Text} - external URL with label
 * - {@link SomeSymbol} - internal cross-reference
 *
 * @internal Exported for testing
 */
export function parseJsDocLinks(text: string, symbolLookup: SymbolLookup): string {
  let result = escapeHtml(text)

  result = result.replace(/\{@link\s+([^\s}]+)(?:\s+([^}]+))?\}/g, (_, target, label) => {
    const displayText = label || target

    // External URL
    if (target.startsWith('http://') || target.startsWith('https://')) {
      return `<a href="${target}" target="_blank" rel="noreferrer" class="docs-link">${displayText}</a>`
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
 * Uses <br> for line breaks to avoid nesting issues with inline elements.
 * Fenced code blocks (```) are syntax-highlighted with Shiki.
 *
 * @internal Exported for testing
 */
export async function renderMarkdown(text: string, symbolLookup: SymbolLookup): Promise<string> {
  // Extract fenced code blocks FIRST (before any HTML escaping)
  // Pattern handles:
  // - Optional whitespace before/after language identifier
  // - \r\n, \n, or \r line endings
  const codeBlockData: Array<{ lang: string; code: string }> = []
  let result = text.replace(
    /```[ \t]*(\w*)[ \t]*(?:\r\n|\r|\n)([\s\S]*?)(?:\r\n|\r|\n)?```/g,
    (_, lang, code) => {
      const index = codeBlockData.length
      codeBlockData.push({ lang: lang || 'text', code: code.trim() })
      return `__CODE_BLOCK_${index}__`
    },
  )

  // Now process the rest (JSDoc links, HTML escaping, etc.)
  result = parseJsDocLinks(result, symbolLookup)

  // Markdown links - i.e. [text](url)
  result = result.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer" class="docs-link">$1</a>',
  )

  // Handle inline code (single backticks) - won't interfere with fenced blocks
  result = result
    .replace(/`([^`]+)`/g, '<code class="docs-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>')

  // Highlight and restore code blocks
  for (let i = 0; i < codeBlockData.length; i++) {
    const { lang, code } = codeBlockData[i]!
    const highlighted = await highlightCodeBlock(code, lang)
    result = result.replace(`__CODE_BLOCK_${i}__`, highlighted)
  }

  return result
}
