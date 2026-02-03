import { describe, expect, it } from 'vitest'
import * as fc from 'fast-check'
import {
  escapeHtml,
  parseJsDocLinks,
  renderMarkdown,
  stripAnsi,
} from '../../../../../server/utils/docs/text'
import type { SymbolLookup } from '../../../../../server/utils/docs/types'

describe('stripAnsi', () => {
  it('should strip basic color codes', () => {
    const ESC = String.fromCharCode(27)
    const input = `${ESC}[0m${ESC}[38;5;12mhello${ESC}[0m`
    expect(stripAnsi(input)).toBe('hello')
  })

  it('should strip multiple ANSI codes', () => {
    const ESC = String.fromCharCode(27)
    const input = `${ESC}[31mred${ESC}[0m and ${ESC}[32mgreen${ESC}[0m`
    expect(stripAnsi(input)).toBe('red and green')
  })

  it('should handle text without ANSI codes', () => {
    expect(stripAnsi('plain text')).toBe('plain text')
  })

  it('should handle empty string', () => {
    expect(stripAnsi('')).toBe('')
  })

  it('should strip 256-color codes', () => {
    const ESC = String.fromCharCode(27)
    const input = `${ESC}[38;5;196mtext${ESC}[0m`
    expect(stripAnsi(input)).toBe('text')
  })

  it('should handle type predicates from deno_doc', () => {
    // Real example: "object is ReactElement<P>" with ANSI codes
    const ESC = String.fromCharCode(27)
    const input = `object is ReactElement${ESC}[0m${ESC}[38;5;12m<${ESC}[0mP${ESC}[38;5;12m>${ESC}[0m`
    expect(stripAnsi(input)).toBe('object is ReactElement<P>')
  })

  it('should strip everything in one pass', () => {
    fc.assert(
      fc.property(fc.string(), input => {
        const stripped = stripAnsi(input)
        expect(stripAnsi(stripped)).toBe(stripped)
      }),
    )
  })
})

describe('escapeHtml', () => {
  it('should escape < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
  })

  it('should escape &', () => {
    expect(escapeHtml('foo & bar')).toBe('foo &amp; bar')
  })

  it('should escape quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;')
    expect(escapeHtml("'hello'")).toBe('&#39;hello&#39;')
  })

  it('should handle multiple special characters', () => {
    expect(escapeHtml('<a href="test?a=1&b=2">')).toBe(
      '&lt;a href=&quot;test?a=1&amp;b=2&quot;&gt;',
    )
  })

  it('should return empty string for empty input', () => {
    expect(escapeHtml('')).toBe('')
  })

  it('should not modify text without special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world')
  })
})

describe('parseJsDocLinks', () => {
  const emptyLookup: SymbolLookup = new Map()

  it('should convert external URLs to links', () => {
    const result = parseJsDocLinks('{@link https://example.com}', emptyLookup)
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('target="_blank"')
    expect(result).toContain('rel="noreferrer"')
  })

  it('should handle external URLs with labels', () => {
    const result = parseJsDocLinks('{@link https://example.com Example Site}', emptyLookup)
    expect(result).toContain('href="https://example.com"')
    expect(result).toContain('>Example Site</a>')
  })

  it('should convert internal symbol references to anchor links', () => {
    const lookup: SymbolLookup = new Map([['MyFunction', 'function-MyFunction']])
    const result = parseJsDocLinks('{@link MyFunction}', lookup)
    expect(result).toContain('href="#function-MyFunction"')
    expect(result).toContain('docs-symbol-link')
  })

  it('should render unknown symbols as code', () => {
    const result = parseJsDocLinks('{@link UnknownSymbol}', emptyLookup)
    expect(result).toContain('<code class="docs-symbol-ref">UnknownSymbol</code>')
  })

  it('should escape HTML in surrounding text', () => {
    const result = parseJsDocLinks('Use <T> with {@link https://example.com}', emptyLookup)
    expect(result).toContain('&lt;T&gt;')
  })

  it('should handle multiple links', () => {
    const result = parseJsDocLinks(
      'See {@link https://a.com} and {@link https://b.com}',
      emptyLookup,
    )
    expect(result).toContain('href="https://a.com"')
    expect(result).toContain('href="https://b.com"')
  })

  it('should not convert non-http URLs to links', () => {
    const result = parseJsDocLinks('{@link javascript:alert(1)}', emptyLookup)
    // Should be treated as unknown symbol, not a link
    expect(result).not.toContain('href="javascript:')
    expect(result).toContain('<code')
  })

  it('should handle http URLs (not just https)', () => {
    const result = parseJsDocLinks('{@link http://example.com}', emptyLookup)
    expect(result).toContain('href="http://example.com"')
  })

  it('should convert external URLs using {@link url} to links', () => {
    fc.assert(
      fc.property(fc.webUrl(), url => {
        const result = parseJsDocLinks(`{@link ${url}}`, emptyLookup)
        expect(result).toContain(`href="${escapeHtml(url)}"`)
        expect(result).toContain('target="_blank"')
        expect(result).toContain('rel="noreferrer"')
        expect(result).toContain(escapeHtml(url))
      }),
    )
  })

  it('should convert external URLs using {@link url text} to links', () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.stringMatching(/^[^}\s][^}]+[^}\s]$/), (url, text) => {
        const result = parseJsDocLinks(`{@link ${url} ${text}}`, emptyLookup)
        expect(result).toContain(`href="${escapeHtml(url)}"`)
        expect(result).toContain('target="_blank"')
        expect(result).toContain('rel="noreferrer"')
        expect(result).toContain(escapeHtml(text))
      }),
    )
  })

  it('should be able to treat correctly several external URLs at the middle of a text', () => {
    const surrounding = fc.stringMatching(/^[^{]*$/)
    const link = fc.record({
      url: fc.webUrl(),
      label: fc.option(fc.stringMatching(/^[^}\s][^}]+[^}\s]$/)),
      before: surrounding,
      after: surrounding,
    })
    fc.assert(
      fc.property(fc.array(link, { minLength: 1 }), content => {
        let docString = ''
        const expectedUrls = []
        for (const chunk of content) {
          if (chunk.before.length !== 0 || docString.length !== 0) {
            docString += `${chunk.before} `
          }
          if (chunk.label === null) {
            docString += `{@link ${chunk.url}}`
            expectedUrls.push(chunk.url)
          } else {
            docString += `{@link ${chunk.url} ${chunk.label}}`
            expectedUrls.push(chunk.url)
          }
          if (chunk.after.length !== 0) {
            docString += ` ${chunk.after}`
          }
        }
        const result = parseJsDocLinks(docString, emptyLookup)
        for (const url of expectedUrls) {
          expect(result).toContain(`href="${escapeHtml(url)}"`)
        }
      }),
    )
  })
})

describe('renderMarkdown', () => {
  const emptyLookup: SymbolLookup = new Map()

  it('should convert inline code', async () => {
    const result = await renderMarkdown('Use `foo()` here', emptyLookup)
    expect(result).toContain('<code class="docs-inline-code">foo()</code>')
  })

  it('should escape HTML inside inline code', async () => {
    const result = await renderMarkdown('Use `Array<T>` here', emptyLookup)
    expect(result).toContain('&lt;T&gt;')
    expect(result).not.toContain('<T>')
  })

  it('should convert bold text', async () => {
    const result = await renderMarkdown('This is **important**', emptyLookup)
    expect(result).toContain('<strong>important</strong>')
  })

  it('should convert single newlines to <br>', async () => {
    const result = await renderMarkdown('line 1\nline 2', emptyLookup)
    expect(result).toBe('line 1<br>line 2')
  })

  it('should convert double newlines to <br><br>', async () => {
    const result = await renderMarkdown('paragraph 1\n\nparagraph 2', emptyLookup)
    expect(result).toBe('paragraph 1<br><br>paragraph 2')
  })

  it('should handle multiple formatting in same text', async () => {
    const result = await renderMarkdown('Use `foo()` for **important** tasks', emptyLookup)
    expect(result).toContain('<code class="docs-inline-code">foo()</code>')
    expect(result).toContain('<strong>important</strong>')
  })

  it('should process {@link} tags', async () => {
    const lookup: SymbolLookup = new Map([['MyFunc', 'function-MyFunc']])
    const result = await renderMarkdown('See {@link MyFunc} for details', lookup)
    expect(result).toContain('href="#function-MyFunc"')
  })

  it('should escape HTML in regular text', async () => {
    const result = await renderMarkdown('Returns <T> or null', emptyLookup)
    expect(result).toContain('&lt;T&gt;')
  })

  it('should handle empty string', async () => {
    expect(await renderMarkdown('', emptyLookup)).toBe('')
  })

  it('should handle text with only whitespace', async () => {
    const result = await renderMarkdown('  \n  ', emptyLookup)
    expect(result).toBe('  <br>  ')
  })

  it('should syntax highlight fenced code blocks with Shiki', async () => {
    const input = '```ts\nconst x = 1;\n```'
    const result = await renderMarkdown(input, emptyLookup)
    // Shiki outputs use class="shiki" and have syntax highlighting spans
    expect(result).toContain('shiki')
    expect(result).toContain('const')
    expect(result).not.toContain('```')
  })

  it('should handle fenced code blocks with CRLF line endings', async () => {
    const input = '```ts\r\nconst x = 1;\r\n```'
    const result = await renderMarkdown(input, emptyLookup)
    expect(result).toContain('shiki')
    expect(result).toContain('const')
    expect(result).not.toContain('```')
  })

  it('should handle fenced code blocks with CR line endings', async () => {
    const input = '```ts\rconst x = 1;\r```'
    const result = await renderMarkdown(input, emptyLookup)
    expect(result).toContain('shiki')
    expect(result).toContain('const')
    expect(result).not.toContain('```')
  })

  it('should handle fenced code blocks without language', async () => {
    const input = '```\nconst x = 1;\n```'
    const result = await renderMarkdown(input, emptyLookup)
    // Falls back to plain code block for unknown language
    expect(result).toContain('<pre>')
    expect(result).toContain('const x = 1;')
  })

  it('should handle fenced code blocks with trailing whitespace after language', async () => {
    const input = '```ts  \nconst x = 1;\n```'
    const result = await renderMarkdown(input, emptyLookup)
    expect(result).toContain('shiki')
    expect(result).toContain('const')
  })

  it('should handle fenced code blocks with space before language', async () => {
    const input = '``` js\nconst x = 1;\n```'
    const result = await renderMarkdown(input, emptyLookup)
    expect(result).toContain('shiki')
    expect(result).toContain('const')
    expect(result).not.toContain('```')
  })

  it('should escape HTML inside fenced code blocks', async () => {
    const input = '```ts\nconst arr: Array<string> = [];\n```'
    const result = await renderMarkdown(input, emptyLookup)
    // Shiki escapes < as &#x3C; (hex entity)
    expect(result).toContain('&#x3C;')
    // The raw < character shouldn't appear outside of HTML tags
    expect(result).not.toMatch(/<string>/)
  })

  it('should handle multiple fenced code blocks', async () => {
    const input = '```ts\nconst a = 1\n```\n\nSome text\n\n```js\nconst b = 2\n```'
    const result = await renderMarkdown(input, emptyLookup)
    expect(result).toContain('Some text')
    // Both code blocks should be highlighted, search for `shiki` class
    expect((result.match(/["\s]shiki["\s]/g) || []).length).toBe(2)
  })

  it('should not confuse inline code with fenced code blocks', async () => {
    const input = 'Use `code` inline and:\n```ts\nblock code\n```'
    const result = await renderMarkdown(input, emptyLookup)
    expect(result).toContain('<code class="docs-inline-code">code</code>')
    expect(result).toContain('shiki')
  })

  it('should handle basic markdown links', async () => {
    const result = await renderMarkdown(
      'This [thing](https://example.com) is really important',
      emptyLookup,
    )
    expect(result).toContain(
      'This <a href="https://example.com" target="_blank" rel="noreferrer" class="docs-link">thing</a> is really important',
    )
  })
})
