import { describe, expect, it } from 'vitest'
import { parseBasicFrontmatter } from '../../../../shared/utils/parse-basic-frontmatter'

describe('parseBasicFrontmatter', () => {
  it('returns empty object for content without frontmatter', () => {
    expect(parseBasicFrontmatter('just some text')).toEqual({})
  })

  it('returns empty object for empty string', () => {
    expect(parseBasicFrontmatter('')).toEqual({})
  })

  it('returns empty object for empty frontmatter block', () => {
    expect(parseBasicFrontmatter('---\n---\n')).toEqual({})
  })

  it('parses string values', () => {
    const input = '---\ntitle: Hello World\nauthor: James\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      title: 'Hello World',
      author: 'James',
    })
  })

  it('strips surrounding quotes from values', () => {
    const input = '---\ntitle: "Hello World"\nauthor: \'James\'\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      title: 'Hello World',
      author: 'James',
    })
  })

  it('parses boolean true', () => {
    const input = '---\ndraft: true\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({ draft: true })
  })

  it('parses boolean false', () => {
    const input = '---\ndraft: false\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({ draft: false })
  })

  it('parses integer values', () => {
    const input = '---\ncount: 42\nnegative: -7\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({ count: 42, negative: -7 })
  })

  it('parses float values', () => {
    const input = '---\nrating: 4.5\nnegative: -3.14\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({ rating: 4.5, negative: -3.14 })
  })

  it('parses array values', () => {
    const input = '---\ntags: [foo, bar, baz]\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      tags: ['foo', 'bar', 'baz'],
    })
  })

  it('strips quotes from array items', () => {
    const input = '---\ntags: ["foo", \'bar\']\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      tags: ['foo', 'bar'],
    })
  })

  it('does not support nested arrays', () => {
    const input = '---\nmatrix: [[1, 2], [3, 4]]\n---\n'
    const result = parseBasicFrontmatter(input)
    expect(result.matrix).toEqual(['[1', '2]', '[3', '4]'])
  })

  it('handles values with colons', () => {
    const input = '---\nurl: https://example.com\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      url: 'https://example.com',
    })
  })

  it('skips lines without colons', () => {
    const input = '---\ntitle: Hello\ninvalid line\nauthor: James\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      title: 'Hello',
      author: 'James',
    })
  })

  it('trims keys and values', () => {
    const input = '---\n  title  :  Hello  \n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({ title: 'Hello' })
  })

  it('handles frontmatter at end of file without trailing newline', () => {
    const input = '---\ntitle: Hello\n---'
    expect(parseBasicFrontmatter(input)).toEqual({ title: 'Hello' })
  })

  it('handles mixed types', () => {
    const input = '---\ntitle: My Post\ncount: 5\nrating: 9.8\npublished: true\ntags: [a, b]\n---\n'
    expect(parseBasicFrontmatter(input)).toEqual({
      title: 'My Post',
      count: 5,
      rating: 9.8,
      published: true,
      tags: ['a', 'b'],
    })
  })
})
