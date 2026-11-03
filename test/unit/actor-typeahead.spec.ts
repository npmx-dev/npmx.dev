import { describe, expect, it } from 'vite-plus/test'
import { normalizeTypeaheadQuery } from '~/composables/useActorTypeahead'

describe('normalizeTypeaheadQuery', () => {
  it('trims, lowercases and strips leading @s', () => {
    expect(normalizeTypeaheadQuery('  @@Alice.NPMX.Social ')).toBe('alice.npmx.social')
  })

  it('rejects queries shorter than two characters', () => {
    expect(normalizeTypeaheadQuery('')).toBe('')
    expect(normalizeTypeaheadQuery('a')).toBe('')
    expect(normalizeTypeaheadQuery(' @ ')).toBe('')
  })

  it('accepts queries at the minimum length', () => {
    expect(normalizeTypeaheadQuery('ab')).toBe('ab')
  })

  it('ignores URLs, which are valid PDS identifiers but not searchable', () => {
    expect(normalizeTypeaheadQuery('https://npmx.social')).toBe('')
    expect(normalizeTypeaheadQuery('HTTP://npmx.social')).toBe('')
  })
})
