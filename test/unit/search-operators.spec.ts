import { describe, expect, it } from 'vitest'
import {
  hasSearchOperators,
  parseSearchOperators,
} from '../../app/composables/useStructuredFilters'

describe('parseSearchOperators', () => {
  describe('basic operator parsing', () => {
    it('parses name: operator', () => {
      const result = parseSearchOperators('name:react')
      expect(result).toEqual({ name: ['react'] })
    })

    it('parses desc: operator', () => {
      const result = parseSearchOperators('desc:framework')
      expect(result).toEqual({ description: ['framework'] })
    })

    it('parses description: operator (long form)', () => {
      const result = parseSearchOperators('description:framework')
      expect(result).toEqual({ description: ['framework'] })
    })

    it('parses kw: operator', () => {
      const result = parseSearchOperators('kw:typescript')
      expect(result).toEqual({ keywords: ['typescript'] })
    })

    it('parses keyword: operator (long form)', () => {
      const result = parseSearchOperators('keyword:typescript')
      expect(result).toEqual({ keywords: ['typescript'] })
    })
  })

  describe('comma-separated values', () => {
    it('parses multiple keywords with comma', () => {
      const result = parseSearchOperators('kw:typescript,react,hooks')
      expect(result).toEqual({ keywords: ['typescript', 'react', 'hooks'] })
    })

    it('parses multiple names with comma', () => {
      const result = parseSearchOperators('name:react,vue,angular')
      expect(result).toEqual({ name: ['react', 'vue', 'angular'] })
    })

    it('handles empty values between commas', () => {
      const result = parseSearchOperators('kw:foo,,bar')
      expect(result).toEqual({ keywords: ['foo', 'bar'] })
    })
  })

  describe('multiple operators', () => {
    it('parses name and kw operators together', () => {
      const result = parseSearchOperators('name:react kw:typescript')
      expect(result).toEqual({
        name: ['react'],
        keywords: ['typescript'],
      })
    })

    it('parses all three operator types', () => {
      const result = parseSearchOperators('name:react desc:framework kw:typescript')
      expect(result).toEqual({
        name: ['react'],
        description: ['framework'],
        keywords: ['typescript'],
      })
    })

    it('merges multiple instances of same operator', () => {
      const result = parseSearchOperators('kw:react kw:typescript')
      expect(result).toEqual({
        keywords: ['react', 'typescript'],
      })
    })
  })

  describe('remaining text', () => {
    it('captures text without operators', () => {
      const result = parseSearchOperators('some search text')
      expect(result).toEqual({ text: 'some search text' })
    })

    it('captures remaining text after operators', () => {
      const result = parseSearchOperators('name:react some text')
      expect(result).toEqual({
        name: ['react'],
        text: 'some text',
      })
    })

    it('captures remaining text before operators', () => {
      const result = parseSearchOperators('some text name:react')
      expect(result).toEqual({
        name: ['react'],
        text: 'some text',
      })
    })

    it('captures text mixed with operators', () => {
      const result = parseSearchOperators('hello name:react world kw:hooks foo')
      expect(result).toEqual({
        name: ['react'],
        keywords: ['hooks'],
        text: 'hello world foo',
      })
    })

    it('collapses multiple spaces in remaining text', () => {
      const result = parseSearchOperators('name:react    lots   of    spaces')
      expect(result).toEqual({
        name: ['react'],
        text: 'lots of spaces',
      })
    })
  })

  describe('case insensitivity', () => {
    it('handles uppercase operator names', () => {
      const result = parseSearchOperators('NAME:react')
      expect(result).toEqual({ name: ['react'] })
    })

    it('handles mixed case operator names', () => {
      const result = parseSearchOperators('NaMe:react KW:typescript')
      expect(result).toEqual({
        name: ['react'],
        keywords: ['typescript'],
      })
    })
  })

  describe('edge cases', () => {
    it('returns empty object for empty string', () => {
      const result = parseSearchOperators('')
      expect(result).toEqual({})
    })

    it('returns empty object for whitespace only', () => {
      const result = parseSearchOperators('   ')
      expect(result).toEqual({})
    })

    it('handles operator with no value', () => {
      // "name:" followed by space - the regex won't match empty values
      const result = parseSearchOperators('name: react')
      expect(result).toEqual({ text: 'name: react' })
    })

    it('handles special characters in values', () => {
      const result = parseSearchOperators('name:@scope/package')
      expect(result).toEqual({ name: ['@scope/package'] })
    })

    it('handles hyphenated values', () => {
      const result = parseSearchOperators('kw:gatsby-plugin')
      expect(result).toEqual({ keywords: ['gatsby-plugin'] })
    })
  })
})

describe('hasSearchOperators', () => {
  it('returns true when name is present', () => {
    expect(hasSearchOperators({ name: ['react'] })).toBe(true)
  })

  it('returns true when description is present', () => {
    expect(hasSearchOperators({ description: ['framework'] })).toBe(true)
  })

  it('returns true when keywords is present', () => {
    expect(hasSearchOperators({ keywords: ['typescript'] })).toBe(true)
  })

  it('returns false when only text is present', () => {
    expect(hasSearchOperators({ text: 'search query' })).toBe(false)
  })

  it('returns false for empty object', () => {
    expect(hasSearchOperators({})).toBe(false)
  })

  it('returns true when operators and text are present', () => {
    expect(hasSearchOperators({ name: ['react'], text: 'query' })).toBe(true)
  })

  it('returns false for empty arrays', () => {
    expect(hasSearchOperators({ name: [], keywords: [] })).toBe(false)
  })
})
