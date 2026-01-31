import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarkdownText from '~/components/MarkdownText.vue'

describe('MarkdownText', () => {
  describe('plain text', () => {
    it('renders plain text unchanged', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'Hello world' },
      })
      expect(component.text()).toBe('Hello world')
    })

    it('returns empty for empty text', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '' },
      })
      expect(component.text()).toBe('')
    })
  })

  describe('HTML escaping', () => {
    it('strips HTML tags to prevent XSS', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '<script>alert("xss")</script>' },
      })
      // HTML tags should be stripped (not rendered)
      expect(component.html()).not.toContain('<script>')
      // Only the text content remains
      expect(component.text()).toBe('alert("xss")')
    })

    it('escapes special characters', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'a < b && c > d' },
      })
      expect(component.text()).toBe('a < b && c > d')
    })
  })

  describe('bold formatting', () => {
    it('renders **text** as bold', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'This is **bold** text' },
      })
      const strong = component.find('strong')
      expect(strong.exists()).toBe(true)
      expect(strong.text()).toBe('bold')
    })

    it('renders __text__ as bold', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'This is __bold__ text' },
      })
      const strong = component.find('strong')
      expect(strong.exists()).toBe(true)
      expect(strong.text()).toBe('bold')
    })
  })

  describe('italic formatting', () => {
    it('renders *text* as italic', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'This is *italic* text' },
      })
      const em = component.find('em')
      expect(em.exists()).toBe(true)
      expect(em.text()).toBe('italic')
    })

    it('renders _text_ as italic', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'This is _italic_ text' },
      })
      const em = component.find('em')
      expect(em.exists()).toBe(true)
      expect(em.text()).toBe('italic')
    })
  })

  describe('inline code', () => {
    it('renders `code` in code tags', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'Run `npm install` to start' },
      })
      const code = component.find('code')
      expect(code.exists()).toBe(true)
      expect(code.text()).toBe('npm install')
    })
  })

  describe('strikethrough', () => {
    it('renders ~~text~~ as strikethrough', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'This is ~~deleted~~ text' },
      })
      const del = component.find('del')
      expect(del.exists()).toBe(true)
      expect(del.text()).toBe('deleted')
    })
  })

  describe('links', () => {
    it('renders [text](https://url) as a link', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'Visit [our site](https://example.com) for more' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://example.com/')
      expect(link.text()).toBe('our site')
    })

    it('adds security attributes to links', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[link](https://example.com)' },
      })
      const link = component.find('a')
      expect(link.attributes('rel')).toBe('nofollow noreferrer noopener')
      expect(link.attributes('target')).toBe('_blank')
    })

    it('allows mailto: links', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'Contact [us](mailto:test@example.com)' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('mailto:test@example.com')
    })

    it('blocks javascript: protocol links', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[click me](javascript:alert("xss"))' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(false)
      expect(component.text()).toContain('click me')
    })

    it('blocks http: links (only https allowed)', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[site](http://example.com)' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(false)
      expect(component.text()).toContain('site')
    })

    it('handles invalid URLs gracefully', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[link](not a valid url)' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(false)
      expect(component.text()).toContain('link')
    })

    it('handles URLs with ampersands', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[search](https://example.com?a=1&b=2)' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(true)
      expect(link.attributes('href')).toBe('https://example.com/?a=1&b=2')
    })
  })

  describe('plain prop', () => {
    it('renders link text without anchor tag when plain=true', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'Visit [our site](https://example.com) for more',
          plain: true,
        },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(false)
      expect(component.text()).toBe('Visit our site for more')
    })

    it('still renders other formatting when plain=true', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: '**bold** and [link](https://example.com)',
          plain: true,
        },
      })
      const strong = component.find('strong')
      const link = component.find('a')
      expect(strong.exists()).toBe(true)
      expect(link.exists()).toBe(false)
      expect(component.text()).toBe('bold and link')
    })
  })

  describe('combined formatting', () => {
    it('handles multiple formatting in one string', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '**bold** and *italic* and `code`' },
      })
      expect(component.find('strong').exists()).toBe(true)
      expect(component.find('em').exists()).toBe(true)
      expect(component.find('code').exists()).toBe(true)
    })
  })

  describe('markdown image stripping', () => {
    it('strips standalone markdown images', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '![badge](https://img.shields.io/badge.svg) A library' },
      })
      expect(component.text()).toBe('A library')
    })

    it('strips linked markdown images (badges)', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: '[![Build Status](https://travis-ci.org/user/repo.svg)](https://travis-ci.org/user/repo) A library',
        },
      })
      expect(component.text()).toBe('A library')
    })

    it('strips multiple badges', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: '[![npm](https://badge.svg)](https://npm.com) [![build](https://ci.svg)](https://ci.com) A library',
        },
      })
      expect(component.text()).toBe('A library')
    })

    it('preserves malformed image syntax without closing paren', async () => {
      // Incomplete/malformed markdown images are left as-is for safety
      const component = await mountSuspended(MarkdownText, {
        props: { text: '![badge](https://example.svg A library' },
      })
      // The image syntax is not stripped because it's malformed (no closing paren)
      expect(component.text()).toBe('![badge](https://example.svg A library')
    })

    it('strips empty link syntax', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[](https://example.com) A library' },
      })
      expect(component.text()).toBe('A library')
    })

    it('preserves regular markdown links', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '[documentation](https://docs.example.com) is here' },
      })
      const link = component.find('a')
      expect(link.exists()).toBe(true)
      expect(link.text()).toBe('documentation')
      expect(component.text()).toBe('documentation is here')
    })
  })

  describe('packageName prop', () => {
    it('strips package name from the beginning of plain text', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'my-package - A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('strips package name with colon separator', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'my-package: A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('strips package name with em dash separator', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'my-package — A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('strips package name without separator', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'my-package A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('is case-insensitive', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'MY-PACKAGE - A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('does not strip package name from middle of text', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'A great my-package library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great my-package library')
    })

    it('handles scoped package names', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: '@org/my-package - A great library',
          packageName: '@org/my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('handles package names with special regex characters', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'pkg.name+test - A great library',
          packageName: 'pkg.name+test',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('strips package name from HTML-containing descriptions', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: '<b>my-package</b> - A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('strips package name from descriptions with markdown images', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: '![badge](https://badge.svg) my-package - A great library',
          packageName: 'my-package',
        },
      })
      expect(component.text()).toBe('A great library')
    })

    it('does nothing when packageName is not provided', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: {
          text: 'my-package - A great library',
        },
      })
      expect(component.text()).toBe('my-package - A great library')
    })
  })

  describe('HTML tag stripping', () => {
    it('strips simple HTML tags but keeps content', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '<b>bold text</b> here' },
      })
      expect(component.text()).toBe('bold text here')
      expect(component.html()).not.toContain('<b>')
    })

    it('strips nested HTML tags', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '<div><span>nested</span> content</div>' },
      })
      expect(component.text()).toBe('nested content')
    })

    it('strips self-closing tags', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'before<br/>after' },
      })
      expect(component.text()).toBe('beforeafter')
    })

    it('strips tags with attributes', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '<a href="https://evil.com">click me</a>' },
      })
      expect(component.text()).toBe('click me')
      expect(component.find('a').exists()).toBe(false)
    })

    it('preserves text that looks like comparison operators', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: 'x < y > z and a < b && c > d' },
      })
      expect(component.text()).toBe('x < y > z and a < b && c > d')
    })

    it('handles mixed HTML and markdown', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '<b>bold</b> and **also bold**' },
      })
      expect(component.text()).toBe('bold and also bold')
      expect(component.find('strong').exists()).toBe(true)
    })
  })
})
