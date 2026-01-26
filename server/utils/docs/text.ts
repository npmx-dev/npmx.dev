/**
 * Text Processing Utilities
 *
 * Functions for escaping HTML, parsing JSDoc links, and rendering markdown.
 *
 * @module server/utils/docs/text
 */

import type { SymbolLookup } from './types'

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
  return `${kind}-${name}`.replace(/[^a-zA-Z0-9-]/g, '_')
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
 * Uses <br> for line breaks to avoid nesting issues with inline elements.
 *
 * @internal Exported for testing
 */
export function renderMarkdown(text: string, symbolLookup: SymbolLookup): string {
  let result = parseJsDocLinks(text, symbolLookup)

  result = result
    .replace(/`([^`]+)`/g, '<code class="docs-inline-code">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n+/g, '<br><br>')
    .replace(/\n/g, '<br>')

  return result
}
