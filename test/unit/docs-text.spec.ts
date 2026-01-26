import { describe, expect, it } from 'vitest'
import {
  escapeHtml,
  parseJsDocLinks,
  renderMarkdown,
  type SymbolLookup,
} from '../../server/utils/docs'

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
    expect(escapeHtml('<a href="test?a=1&b=2">'))
      .toBe('&lt;a href=&quot;test?a=1&amp;b=2&quot;&gt;')
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
    expect(result).toContain('rel="noopener"')
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
})

describe('renderMarkdown', () => {
  const emptyLookup: SymbolLookup = new Map()

  it('should convert inline code', () => {
    const result = renderMarkdown('Use `foo()` here', emptyLookup)
    expect(result).toContain('<code class="docs-inline-code">foo()</code>')
  })

  it('should escape HTML inside inline code', () => {
    const result = renderMarkdown('Use `Array<T>` here', emptyLookup)
    expect(result).toContain('&lt;T&gt;')
    expect(result).not.toContain('<T>')
  })

  it('should convert bold text', () => {
    const result = renderMarkdown('This is **important**', emptyLookup)
    expect(result).toContain('<strong>important</strong>')
  })

  it('should convert single newlines to <br>', () => {
    const result = renderMarkdown('line 1\nline 2', emptyLookup)
    expect(result).toBe('line 1<br>line 2')
  })

  it('should convert double newlines to <br><br>', () => {
    const result = renderMarkdown('paragraph 1\n\nparagraph 2', emptyLookup)
    expect(result).toBe('paragraph 1<br><br>paragraph 2')
  })

  it('should handle multiple formatting in same text', () => {
    const result = renderMarkdown('Use `foo()` for **important** tasks', emptyLookup)
    expect(result).toContain('<code class="docs-inline-code">foo()</code>')
    expect(result).toContain('<strong>important</strong>')
  })

  it('should process {@link} tags', () => {
    const lookup: SymbolLookup = new Map([['MyFunc', 'function-MyFunc']])
    const result = renderMarkdown('See {@link MyFunc} for details', lookup)
    expect(result).toContain('href="#function-MyFunc"')
  })

  it('should escape HTML in regular text', () => {
    const result = renderMarkdown('Returns <T> or null', emptyLookup)
    expect(result).toContain('&lt;T&gt;')
  })

  it('should handle empty string', () => {
    expect(renderMarkdown('', emptyLookup)).toBe('')
  })

  it('should handle text with only whitespace', () => {
    const result = renderMarkdown('  \n  ', emptyLookup)
    expect(result).toBe('  <br>  ')
  })
})
