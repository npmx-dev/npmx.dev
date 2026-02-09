import { describe, expect, it } from 'vitest'
import { escapeRawGt, highlightCodeBlock } from '../../../../server/utils/shiki'

describe('escapeRawGt', () => {
  it('should encode > in arrow functions', () => {
    const input = '<span style="color:#F97583">=></span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span style="color:#F97583">=&gt;</span>')
  })

  it('should encode > in comparison operators', () => {
    const input = '<span>x > 5</span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span>x &gt; 5</span>')
  })

  it('should encode multiple > in text content', () => {
    const input = '<span>a > b > c</span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span>a &gt; b &gt; c</span>')
  })

  it('should not affect HTML tag structure', () => {
    const input = '<span class="test"><code>text</code></span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span class="test"><code>text</code></span>')
  })

  it('should not affect attributes containing >', () => {
    // Attributes with > are already encoded by Shiki, but test anyway
    const input = '<span title="a &gt; b">text</span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span title="a &gt; b">text</span>')
  })

  it('should handle empty text content', () => {
    const input = '<span></span><code></code>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span></span><code></code>')
  })

  it('should handle text without special characters', () => {
    const input = '<span>hello world</span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span>hello world</span>')
  })

  it('should handle nested spans (Shiki output structure)', () => {
    const input =
      '<span class="line"><span style="color:#F97583">const</span><span> x = () =></span><span> 5</span></span>'
    const output = escapeRawGt(input)
    expect(output).toBe(
      '<span class="line"><span style="color:#F97583">const</span><span> x = () =&gt;</span><span> 5</span></span>',
    )
  })

  it('should handle >= operator', () => {
    const input = '<span>x >= 5</span>'
    const output = escapeRawGt(input)
    expect(output).toBe('<span>x &gt;= 5</span>')
  })

  it('should handle generic type syntax', () => {
    const input = '<span>Array&lt;T></span>'
    const output = escapeRawGt(input)
    // The < is already encoded, the > should be encoded
    expect(output).toBe('<span>Array&lt;T&gt;</span>')
  })
})

describe('highlightCodeBlock', () => {
  it('should highlight TypeScript code', async () => {
    const code = 'const x = 1'
    const html = await highlightCodeBlock(code, 'typescript')

    expect(html).toContain('<pre')
    expect(html).toContain('const')
    expect(html).toContain('shiki')
  })

  it('should encode > in arrow functions', async () => {
    const code = 'const fn = () => 5'
    const html = await highlightCodeBlock(code, 'typescript')

    // The > in => should be encoded
    expect(html).toContain('=&gt;')
    expect(html).not.toMatch(/=>(?!&)/) // no raw => (except in &gt;)
  })

  it('should encode > in generic types', async () => {
    const code = 'const x: Array<string> = []'
    const html = await highlightCodeBlock(code, 'typescript')

    // Should have encoded >
    expect(html).toContain('&gt;')
  })

  it('should fall back to plain code for unknown languages', async () => {
    const code = 'some random code > with special < chars'
    const html = await highlightCodeBlock(code, 'unknownlang123')

    expect(html).toContain('&gt;')
    expect(html).toContain('&lt;')
    expect(html).toContain('language-unknownlang123')
  })

  it('should escape special characters in fallback', async () => {
    const code = '<script>alert("xss")</script>'
    const html = await highlightCodeBlock(code, 'unknownlang123')

    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
