import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

let highlighter: HighlighterCore | null = null

export async function getShikiHighlighter(): Promise<HighlighterCore> {
  if (!highlighter) {
    highlighter = await createHighlighterCore({
      themes: [import('@shikijs/themes/github-dark'), import('@shikijs/themes/github-light')],
      langs: [
        // Core web languages
        import('@shikijs/langs/javascript'),
        import('@shikijs/langs/typescript'),
        import('@shikijs/langs/json'),
        import('@shikijs/langs/jsonc'),
        import('@shikijs/langs/html'),
        import('@shikijs/langs/css'),
        import('@shikijs/langs/scss'),
        import('@shikijs/langs/less'),

        // Frameworks
        import('@shikijs/langs/vue'),
        import('@shikijs/langs/jsx'),
        import('@shikijs/langs/tsx'),
        import('@shikijs/langs/svelte'),
        import('@shikijs/langs/astro'),
        import('@shikijs/langs/glimmer-js'),
        import('@shikijs/langs/glimmer-ts'),

        // Shell/CLI
        import('@shikijs/langs/bash'),
        import('@shikijs/langs/shell'),

        // Config/Data formats
        import('@shikijs/langs/yaml'),
        import('@shikijs/langs/toml'),
        import('@shikijs/langs/xml'),
        import('@shikijs/langs/markdown'),

        // Other languages
        import('@shikijs/langs/diff'),
        import('@shikijs/langs/sql'),
        import('@shikijs/langs/graphql'),
        import('@shikijs/langs/python'),
        import('@shikijs/langs/rust'),
        import('@shikijs/langs/go'),
      ],
      langAlias: {
        gjs: 'glimmer-js',
        gts: 'glimmer-ts',
      },
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighter
}

/**
 * Synchronously highlight a code block using an already-initialized highlighter.
 * Use this when you have already awaited getShikiHighlighter() and need to
 * highlight multiple blocks without async overhead (e.g., in marked renderers).
 *
 * @param shiki - The initialized Shiki highlighter instance
 * @param code - The code to highlight
 * @param language - The language identifier (e.g., 'typescript', 'bash')
 * @returns HTML string with syntax highlighting
 */
export function highlightCodeSync(shiki: HighlighterCore, code: string, language: string): string {
  const loadedLangs = shiki.getLoadedLanguages()

  if (loadedLangs.includes(language as never)) {
    try {
      let html = shiki.codeToHtml(code, {
        lang: language,
        themes: { light: 'github-light', dark: 'github-dark' },
        defaultColor: 'dark',
      })
      // Remove inline style from <pre> tag so CSS can control appearance
      html = html.replace(/<pre([^>]*)\s+style="[^"]*"/, '<pre$1')
      // Shiki doesn't encode > in text content (e.g., arrow functions =>)
      // We need to encode them for HTML validation
      return escapeRawGt(html)
    } catch {
      // Fall back to plain
    }
  }

  // Plain code block for unknown languages
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<pre><code class="language-${language}">${escaped}</code></pre>\n`
}

/**
 * Highlight a code block with syntax highlighting (async convenience wrapper).
 * Initializes the highlighter if needed, then delegates to highlightCodeSync.
 *
 * @param code - The code to highlight
 * @param language - The language identifier (e.g., 'typescript', 'bash')
 * @returns HTML string with syntax highlighting
 */
export async function highlightCodeBlock(code: string, language: string): Promise<string> {
  const shiki = await getShikiHighlighter()
  return highlightCodeSync(shiki, code, language)
}

/**
 * Escape raw > characters in HTML text content.
 * Shiki outputs > without encoding in constructs like arrow functions (=>).
 * This replaces > that appear in text content (after >) but not inside tags.
 *
 * @internal Exported for testing
 */
export function escapeRawGt(html: string): string {
  // Match > that appears after a closing tag or other > (i.e., in text content)
  // Pattern: after </...> or after >, match any > that isn't starting a tag
  return html.replace(/>([^<]*)/g, (match, textContent) => {
    // Encode any > in the text content portion
    const escapedText = textContent.replace(/>/g, '&gt;')
    return `>${escapedText}`
  })
}
