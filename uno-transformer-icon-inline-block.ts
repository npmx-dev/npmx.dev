import type { SourceCodeTransformer } from 'unocss'

/**
 * Transformer that automatically adds `inline-block` next to any icon class
 * (`i-*`) in the source code, so the class appears in the rendered HTML.
 */
export function transformerIconInlineBlock(): SourceCodeTransformer {
  return {
    name: 'icon-inline-block',
    enforce: 'pre',
    transform(s) {
      const code = s.original
      // Match icon classes like i-lucide-star, i-mdi-home, i-custom-vlt etc.
      const iconClassRe = /\bi-[\w:-]+/g
      let match: RegExpExecArray | null

      while ((match = iconClassRe.exec(code)) !== null) {
        const end = match.index + match[0].length
        // Skip if `inline-block` already follows (with optional whitespace)
        if (/^\s+inline-block\b/.test(code.slice(end))) {
          continue
        }
        s.appendRight(end, ' inline-block w-[1.2em]! h-[1.2em]!')
      }
    },
  }
}
