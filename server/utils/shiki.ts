import { createHighlighterCore, type HighlighterCore } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'

let highlighter: HighlighterCore | null = null

export async function getShikiHighlighter(): Promise<HighlighterCore> {
  if (!highlighter) {
    highlighter = await createHighlighterCore({
      themes: [
        import('@shikijs/themes/github-dark'),
      ],
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
      engine: createJavaScriptRegexEngine(),
    })
  }
  return highlighter
}

export async function highlightCodeBlock(code: string, language: string): Promise<string> {
  const shiki = await getShikiHighlighter()
  const loadedLangs = shiki.getLoadedLanguages()

  if (loadedLangs.includes(language as never)) {
    try {
      return shiki.codeToHtml(code, {
        lang: language,
        theme: 'github-dark',
      })
    }
    catch {
      // Fall back to plain
    }
  }

  // Plain code block for unknown languages
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  return `<pre><code class="language-${language}">${escaped}</code></pre>\n`
}
