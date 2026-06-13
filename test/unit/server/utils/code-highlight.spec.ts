import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  getLanguageFromPath,
  highlightCode,
  linkifyModuleSpecifiers,
} from '#server/utils/code-highlight'

const mockGetShikiHighlighter = vi.fn()

beforeAll(() => {
  vi.stubGlobal('escapeRawGt', (html: string) => html)
  vi.stubGlobal('getShikiHighlighter', mockGetShikiHighlighter)
})

describe('linkifyModuleSpecifiers', () => {
  const dependencies = {
    'vue': { version: '3.4.0' },
    '@unocss/webpack': { version: '0.65.3' },
  }

  it('should linkify import ... from "package"', () => {
    // Shiki output for: import { ref } from "vue"
    const html =
      '<span class="line">' +
      '<span style="color:#F97583">import</span>' +
      '<span style="color:#E1E4E8"> { ref }</span>' +
      '<span style="color:#F97583">from</span>' +
      '<span style="color:#9ECBFF"> "vue"</span>' +
      '</span>'

    const result = linkifyModuleSpecifiers(html, { dependencies })
    expect(result).toContain('<a href="/package-code/vue/v/3.4.0" class="import-link">')
  })

  it('should linkify export * from "package"', () => {
    // Shiki output for: export * from "@unocss/webpack"
    // Note: Shiki puts a leading space before "from" in the same span
    const html =
      '<span class="line">' +
      '<span style="color:#F97583">export</span>' +
      '<span style="color:#E1E4E8"> *</span>' +
      '<span style="color:#F97583"> from</span>' +
      '<span style="color:#9ECBFF"> "@unocss/webpack"</span>' +
      '<span style="color:#E1E4E8">;</span>' +
      '</span>'

    const result = linkifyModuleSpecifiers(html, { dependencies })
    expect(result).toContain(
      '<a href="/package-code/@unocss/webpack/v/0.65.3" class="import-link">',
    )
  })

  it('prefers file-aware resolver for self package subpath imports', () => {
    const html =
      '<span class="line">' +
      '<span style="color:#F97583">import</span>' +
      '<span style="color:#E1E4E8"> * as walk </span>' +
      '<span style="color:#F97583">from</span>' +
      '<span style="color:#9ECBFF"> "empathic/walk"</span>' +
      '</span>'

    const result = linkifyModuleSpecifiers(html, {
      dependencies,
      resolveRelative: specifier =>
        specifier.includes('empathic/walk') ? '/package-code/empathic/v/2.0.0/walk.mjs' : null,
    })

    expect(result).toContain(
      '<a href="/package-code/empathic/v/2.0.0/walk.mjs" class="import-link">"empathic/walk"</a>',
    )
  })

  it('linkifies when spacing around "from" varies across tokens', () => {
    const html =
      '<span class="line">' +
      '<span style="color:#F97583">import</span>' +
      '<span style="color:#E1E4E8"> * as walk </span>' +
      '<span style="color:#F97583">from </span>' +
      '<span style="color:#9ECBFF">"empathic/walk"</span>' +
      '</span>'

    const result = linkifyModuleSpecifiers(html, {
      resolveRelative: specifier =>
        specifier.includes('empathic/walk') ? '/package-code/empathic/v/2.0.0/walk.mjs' : null,
    })

    expect(result).toContain(
      '<a href="/package-code/empathic/v/2.0.0/walk.mjs" class="import-link">"empathic/walk"</a>',
    )
  })

  it('falls back to dependency links when the file-aware resolver cannot resolve a specifier', () => {
    const html =
      '<span class="line">' +
      '<span style="color:#F97583">import</span>' +
      '<span style="color:#9ECBFF"> "vue"</span>' +
      '</span>'

    const result = linkifyModuleSpecifiers(html, {
      dependencies,
      resolveRelative: () => null,
    })

    expect(result).toContain('<a href="/package-code/vue/v/3.4.0" class="import-link">"vue"</a>')
  })

  it('linkifies side-effect imports even when import token spacing varies', () => {
    const html =
      '<span class="line">' +
      '<span style="color:#F97583"> import </span>' +
      '<span style="color:#9ECBFF"> "@unocss/webpack" </span>' +
      '</span>'

    const result = linkifyModuleSpecifiers(html, { dependencies })

    expect(result).toContain(
      '<a href="/package-code/@unocss/webpack/v/0.65.3" class="import-link">"@unocss/webpack"</a>',
    )
  })

  it('does not link Node built-ins or package specifiers when they are not dependencies', () => {
    const htmlFrom = `<span style="color:#F97583">from</span><span style="color:#9ECBFF"> "fs"</span>`
    const htmlSide =
      '<span style="color:#F97583"> import </span>' +
      '<span style="color:#9ECBFF"> "node:path" </span>'

    expect(linkifyModuleSpecifiers(htmlFrom, { dependencies: {} })).toBe(htmlFrom)
    expect(linkifyModuleSpecifiers(htmlSide, { dependencies: {} })).toBe(htmlSide)

    const unknown =
      '<span style="color:#F97583">from</span>' +
      '<span style="color:#9ECBFF"> "not-in-deps"</span>'
    const linked = linkifyModuleSpecifiers(unknown, { dependencies: {} })
    expect(linked).toContain('<a href="/package/not-in-deps" class="import-link">"not-in-deps"</a>')
  })

  it('linkifies require() and dynamic import() calls', () => {
    const requireHtml =
      '<span class="line">' +
      '<span style="color:#x">require</span>' +
      '<span style="color:#y">(</span>' +
      '<span style="color:#z">\'vue\'</span>' +
      '</span>'

    const dynImportHtml =
      '<span class="line">' +
      '<span style="color:#x">import</span>' +
      '<span style="color:#y">(</span>' +
      '<span style="color:#z">"vue"</span>' +
      '</span>'

    const deps = { vue: { version: '3.4.0' } }

    expect(linkifyModuleSpecifiers(requireHtml, { dependencies: deps })).toContain(
      '<a href="/package-code/vue/v/3.4.0" class="import-link">\'vue\'</a>',
    )
    expect(linkifyModuleSpecifiers(dynImportHtml, { dependencies: deps })).toContain(
      '<a href="/package-code/vue/v/3.4.0" class="import-link">"vue"</a>',
    )
  })

  it('still links import() when the keyword is split across adjacent spans (e.g. dyn+import)', () => {
    const html =
      '<span class="line">' +
      '<span>dyn</span><span>import</span>' +
      '<span>(</span>' +
      "<span>'vue'</span>" +
      '</span>'

    const linked = linkifyModuleSpecifiers(html, { dependencies: { vue: { version: '3.4.0' } } })
    expect(linked).toContain('<a href="/package-code/vue/v/3.4.0" class="import-link">')
  })
})

describe('getLanguageFromPath', () => {
  it('prefers well-known filenames over extension heuristics', () => {
    expect(getLanguageFromPath('foo/README.md')).toBe('markdown')
    expect(getLanguageFromPath('nested/tsconfig.json')).toBe('jsonc')
    expect(getLanguageFromPath('.gitignore')).toBe('bash')
    expect(getLanguageFromPath('pnpm-lock.yaml')).toBe('yaml')
  })

  it('maps extensions and falls back to plain text', () => {
    expect(getLanguageFromPath('src/a.ts')).toBe('typescript')
    expect(getLanguageFromPath('src/b.vue')).toBe('vue')
    expect(getLanguageFromPath('notes.mdx')).toBe('markdown')
    expect(getLanguageFromPath('weird.unknownext')).toBe('text')
  })
})

describe('highlightCode', () => {
  afterEach(() => {
    mockGetShikiHighlighter.mockReset()
  })

  it('collapses newline gaps between Shiki line spans', async () => {
    mockGetShikiHighlighter.mockResolvedValue({
      getLoadedLanguages: () => ['typescript'],
      codeToHtml: () =>
        '<pre><code><span class="line">const x = 1;</span>\n<span class="line">console.log(x)</span></code></pre>',
    })

    const html = await highlightCode('const x = 1;\nconsole.log(x)', 'typescript')
    expect(html).not.toContain('</span>\n<span class="line">')
    expect(html).toContain('<span class="line">')
  })

  it('wraps lines manually when Shiki output omits .line spans', async () => {
    mockGetShikiHighlighter.mockResolvedValue({
      getLoadedLanguages: () => ['typescript'],
      codeToHtml: () =>
        '<pre class="shiki"><code><span style="color:#1">line-a</span>\n<span style="color:#2">line-b</span></code></pre>',
    })

    const html = await highlightCode('line-a\nline-b', 'typescript')
    expect(html).toContain('<span class="line"><span style="color:#1">line-a</span></span>')
    expect(html).toContain('<span class="line"><span style="color:#2">line-b</span></span>')
  })

  it('runs linkify when the loaded language is import-aware', async () => {
    mockGetShikiHighlighter.mockResolvedValue({
      getLoadedLanguages: () => ['javascript'],
      codeToHtml: () =>
        '<pre><code>' +
        '<span class="line">' +
        '<span>import</span><span> foo </span><span>from</span><span> "vue"</span>' +
        '</span></code></pre>',
    })

    const html = await highlightCode('import foo from "vue"', 'javascript', {
      dependencies: { vue: { version: '3.4.0' } },
    })
    expect(html).toContain('/package-code/vue/v/3.4.0')
  })

  it('does not treat markdown as an import-linking language', async () => {
    mockGetShikiHighlighter.mockResolvedValue({
      getLoadedLanguages: () => ['markdown'],
      codeToHtml: () =>
        '<pre><code><span class="line">' +
        '<span>import</span><span> x </span><span>from</span><span> "vue"</span>' +
        '</span></code></pre>',
    })

    const html = await highlightCode('import x from "vue"', 'markdown', {
      dependencies: { vue: { version: '3.4.0' } },
    })
    expect(html).not.toContain('import-link')
  })

  it('falls back to escaped wrappers when the language is not loaded', async () => {
    mockGetShikiHighlighter.mockResolvedValue({
      getLoadedLanguages: () => ['typescript'],
      codeToHtml: () => '',
    })

    const html = await highlightCode('a < b', 'not-a-real-lang', {})
    expect(html).toContain('&lt;')
    expect(html).toContain('<span class="line">')
    expect(html).toContain('github-dark')
  })

  it('falls back when Shiki throws while highlighting', async () => {
    mockGetShikiHighlighter.mockResolvedValue({
      getLoadedLanguages: () => ['typescript'],
      codeToHtml: () => {
        throw new Error('shiki failed')
      },
    })

    const html = await highlightCode('hello', 'typescript', {})
    expect(html).toContain('<span class="line">hello</span>')
  })
})
