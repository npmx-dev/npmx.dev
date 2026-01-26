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
    it('escapes HTML tags to prevent XSS', async () => {
      const component = await mountSuspended(MarkdownText, {
        props: { text: '<script>alert("xss")</script>' },
      })
      expect(component.html()).not.toContain('<script>')
      expect(component.text()).toContain('<script>')
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
})
