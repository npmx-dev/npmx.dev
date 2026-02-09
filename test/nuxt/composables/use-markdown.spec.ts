import { describe, expect, it } from 'vitest'

// Utility to use more human-readable strings in tests
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

describe('useMarkdown', () => {
  describe('plain text', () => {
    it('renders plain text unchanged', () => {
      const processed = useMarkdown({ text: 'Hello world' })
      expect(processed.value).toBe('Hello world')
    })

    it('returns empty for empty text', () => {
      const processed = useMarkdown({ text: '' })
      expect(processed.value).toBe('')
    })
  })

  describe('HTML escaping', () => {
    it('strips HTML tags to prevent XSS', () => {
      const processed = useMarkdown({ text: '<script>alert("xss")</script>' })
      // HTML tags should be stripped (not rendered)
      expect(processed.value).not.toContain('<script>')
      // Only the text content remains
      expect(processed.value).toBe(escapeHtml('alert("xss")'))
    })

    it('escapes special characters', () => {
      const processed = useMarkdown({ text: 'a < b && c > d' })
      expect(processed.value).toBe(escapeHtml('a < b && c > d'))
    })
  })

  describe('bold formatting', () => {
    it('renders **text** as bold', () => {
      const processed = useMarkdown({ text: 'This is **bold** text' })
      expect(processed.value).toContain('<strong>')
      expect(processed.value).toContain('bold')
    })

    it('renders __text__ as bold', () => {
      const processed = useMarkdown({ text: 'This is __bold__ text' })
      expect(processed.value).toContain('<strong>')
      expect(processed.value).toContain('bold')
    })
  })

  describe('italic formatting', () => {
    it('renders *text* as italic', () => {
      const processed = useMarkdown({ text: 'This is *italic* text' })
      expect(processed.value).toContain('<em>')
      expect(processed.value).toContain('italic')
    })

    it('renders _text_ as italic', () => {
      const processed = useMarkdown({ text: 'This is _italic_ text' })
      expect(processed.value).toContain('<em>')
      expect(processed.value).toContain('italic')
    })
  })

  describe('inline code', () => {
    it('renders `code` in code tags', () => {
      const processed = useMarkdown({ text: 'Run `npm install` to start' })
      expect(processed.value).toContain('<code>')
      expect(processed.value).toContain('npm install')
    })
  })

  describe('strikethrough', () => {
    it('renders ~~text~~ as strikethrough', () => {
      const processed = useMarkdown({ text: 'This is ~~deleted~~ text' })
      expect(processed.value).toContain('<del>')
      expect(processed.value).toContain('deleted')
    })
  })

  describe('links', () => {
    it('renders [text](https://url) as a link', () => {
      const processed = useMarkdown({ text: 'Visit [our site](https://example.com) for more' })
      expect(processed.value).toContain(
        '<a href="https://example.com/" rel="nofollow noreferrer noopener" target="_blank">our site</a>',
      )
    })

    it('adds security attributes to links', () => {
      const processed = useMarkdown({ text: '[link](https://example.com)' })
      expect(processed.value).toBe(
        '<a href="https://example.com/" rel="nofollow noreferrer noopener" target="_blank">link</a>',
      )
    })

    it('allows mailto: links', () => {
      const processed = useMarkdown({ text: 'Contact [us](mailto:test@example.com)' })
      expect(processed.value).toContain(
        '<a href="mailto:test@example.com" rel="nofollow noreferrer noopener" target="_blank">us</a>',
      )
    })

    it('blocks javascript: protocol links', () => {
      const processed = useMarkdown({ text: '[click me](javascript:alert("xss"))' })
      expect(processed.value).toBe(`click me ${escapeHtml('(javascript:alert("xss"))')}`)
    })

    it('blocks http: links (only https allowed)', () => {
      const processed = useMarkdown({ text: '[site](http://example.com)' })
      expect(processed.value).toBe('site (http://example.com)')
    })

    it('handles invalid URLs gracefully', () => {
      const processed = useMarkdown({ text: '[link](not a valid url)' })
      expect(processed.value).toBe('link (not a valid url)')
    })

    it('handles URLs with ampersands', () => {
      const processed = useMarkdown({ text: '[search](https://example.com?a=1&b=2)' })
      expect(processed.value).toBe(
        '<a href="https://example.com/?a=1&b=2" rel="nofollow noreferrer noopener" target="_blank">search</a>',
      )
    })
  })

  describe('plain prop', () => {
    it('renders link text without anchor tag when plain=true', () => {
      const processed = useMarkdown({
        text: 'Visit [our site](https://example.com) for more',
        plain: true,
      })
      expect(processed.value).toBe('Visit our site for more')
    })

    it('still renders other formatting when plain=true', () => {
      const processed = useMarkdown({
        text: '**bold** and [link](https://example.com)',
        plain: true,
      })
      expect(processed.value).toBe('<strong>bold</strong> and link')
    })
  })

  describe('combined formatting', () => {
    it('handles multiple formatting in one string', () => {
      const processed = useMarkdown({ text: '**bold** and *italic* and `code`' })
      expect(processed.value).toContain('<strong>')
      expect(processed.value).toContain('<em>')
      expect(processed.value).toContain('<code>')
    })
  })

  describe('markdown image stripping', () => {
    it('strips standalone markdown images', () => {
      const processed = useMarkdown({
        text: '![badge](https://img.shields.io/badge.svg) A library',
      })
      expect(processed.value).toBe('A library')
    })

    it('strips linked markdown images (badges)', () => {
      const processed = useMarkdown({
        text: '[![Build Status](https://travis-ci.org/user/repo.svg)](https://travis-ci.org/user/repo) A library',
      })
      expect(processed.value).toBe('A library')
    })

    it('strips multiple badges', () => {
      const processed = useMarkdown({
        text: '[![npm](https://badge.svg)](https://npm.com) [![build](https://ci.svg)](https://ci.com) A library',
      })
      expect(processed.value).toBe('A library')
    })

    it('preserves malformed image syntax without closing paren', () => {
      // Incomplete/malformed markdown images are left as-is for safety
      const processed = useMarkdown({ text: '![badge](https://example.svg A library' })
      // The image syntax is not stripped because it's malformed (no closing paren)
      expect(processed.value).toBe('![badge](https://example.svg A library')
    })

    it('strips empty link syntax', () => {
      const processed = useMarkdown({ text: '[](https://example.com) A library' })
      expect(processed.value).toBe('A library')
    })

    it('preserves regular markdown links', () => {
      const processed = useMarkdown({ text: '[documentation](https://docs.example.com) is here' })
      expect(processed.value).toBe(
        '<a href="https://docs.example.com/" rel="nofollow noreferrer noopener" target="_blank">documentation</a> is here',
      )
    })
  })

  describe('packageName prop', () => {
    it('strips package name from the beginning of plain text', () => {
      const processed = useMarkdown({
        text: 'my-package - A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('strips package name with colon separator', () => {
      const processed = useMarkdown({
        text: 'my-package: A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('strips package name with em dash separator', () => {
      const processed = useMarkdown({
        text: 'my-package — A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('strips package name without separator', () => {
      const processed = useMarkdown({
        text: 'my-package A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('is case-insensitive', () => {
      const processed = useMarkdown({
        text: 'MY-PACKAGE - A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('does not strip package name from middle of text', () => {
      const processed = useMarkdown({
        text: 'A great my-package library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great my-package library')
    })

    it('handles scoped package names', () => {
      const processed = useMarkdown({
        text: '@org/my-package - A great library',
        packageName: '@org/my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('handles package names with special regex characters', () => {
      const processed = useMarkdown({
        text: 'pkg.name+test - A great library',
        packageName: 'pkg.name+test',
      })
      expect(processed.value).toBe('A great library')
    })

    it('strips package name from HTML-containing descriptions', () => {
      const processed = useMarkdown({
        text: '<b>my-package</b> - A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('strips package name from descriptions with markdown images', () => {
      const processed = useMarkdown({
        text: '![badge](https://badge.svg) my-package - A great library',
        packageName: 'my-package',
      })
      expect(processed.value).toBe('A great library')
    })

    it('does nothing when packageName is not provided', () => {
      const processed = useMarkdown({
        text: 'my-package - A great library',
      })
      expect(processed.value).toBe('my-package - A great library')
    })
  })

  describe('HTML tag stripping', () => {
    it('strips simple HTML tags but keeps content', () => {
      const processed = useMarkdown({ text: '<b>bold text</b> here' })
      expect(processed.value).toBe('bold text here')
      expect(processed.value).not.toContain('<b>')
    })

    it('strips nested HTML tags', () => {
      const processed = useMarkdown({ text: '<div><span>nested</span> content</div>' })
      expect(processed.value).toBe('nested content')
    })

    it('strips self-closing tags', () => {
      const processed = useMarkdown({ text: 'before<br/>after' })
      expect(processed.value).toBe('beforeafter')
    })

    it('strips tags with attributes', () => {
      const processed = useMarkdown({ text: '<a href="https://evil.com">click me</a>' })
      expect(processed.value).toBe('click me')
      expect(processed.value).not.toContain('<a href="https://evil.com">')
    })

    it('preserves text that looks like comparison operators', () => {
      const processed = useMarkdown({ text: 'x < y > z and a < b && c > d' })
      expect(processed.value).toBe(escapeHtml('x < y > z and a < b && c > d'))
    })

    it('handles mixed HTML and markdown', () => {
      const processed = useMarkdown({ text: '<b>bold</b> and **also bold**' })
      expect(processed.value).toBe('bold and <strong>also bold</strong>')
    })
  })
})
