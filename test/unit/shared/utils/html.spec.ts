import { describe, expect, it } from 'vitest'
import { decodeHtmlEntities, stripHtmlTags } from '#shared/utils/html'

describe('decodeHtmlEntities', () => {
  it.each([
    ['&amp;', '&'],
    ['&lt;', '<'],
    ['&gt;', '>'],
    ['&quot;', '"'],
    ['&#39;', "'"],
    ['&apos;', "'"],
    ['&nbsp;', '\u00A0'],
  ] as const)('%s → %s', (input, expected) => {
    expect(decodeHtmlEntities(input)).toBe(expected)
  })

  it('decodes multiple entities in one string', () => {
    expect(decodeHtmlEntities('a &amp; b &lt; c')).toBe('a & b < c')
  })

  it('leaves plain text unchanged', () => {
    expect(decodeHtmlEntities('say no to bloat')).toBe('say no to bloat')
  })

  it('leaves unknown entities unchanged', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;')
  })
})

describe('stripHtmlTags', () => {
  it('removes simple HTML tags', () => {
    expect(stripHtmlTags('<b>bold</b>')).toBe('bold')
  })

  it('removes anchor tags keeping text content', () => {
    expect(stripHtmlTags('<a href="https://example.com">link</a>')).toBe('link')
  })

  it('removes self-closing tags', () => {
    expect(stripHtmlTags('before<br/>after')).toBe('beforeafter')
  })

  it('leaves plain text unchanged', () => {
    expect(stripHtmlTags('no tags here')).toBe('no tags here')
  })

  it('works with decodeHtmlEntities to clean descriptions', () => {
    const raw = '&lt;a href=&quot;url&quot;&gt;link&lt;/a&gt; and text'
    expect(stripHtmlTags(decodeHtmlEntities(raw))).toBe('link and text')
  })

  it('removes unclosed HTML tags at the end of truncated text', () => {
    expect(stripHtmlTags('A library <img src="https://img.s')).toBe('A library')
  })

  it('returns empty string when truncated text is only HTML tags', () => {
    expect(
      stripHtmlTags(
        '<p>   <a href="https://www.npmjs.com/package/vue-tsc"><img src="https://img.shields.io/npm/v/vue-tsc.svg"></a>   <img src="https://img.s',
      ),
    ).toBe('')
  })

  it('leaves comparison text that is not a tag', () => {
    expect(stripHtmlTags('a < b')).toBe('a < b')
  })
})
