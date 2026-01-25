import { describe, it, expect } from 'vitest'
import {
  normalizePackageName,
  levenshteinDistance,
  isValidNewPackageName,
} from '../../app/utils/package-name'

describe('package-name utilities', () => {
  describe('normalizePackageName', () => {
    it('normalizes simple names', () => {
      expect(normalizePackageName('lodash')).toBe('lodash')
      expect(normalizePackageName('my-package')).toBe('mypackage')
      expect(normalizePackageName('my_package')).toBe('mypackage')
      expect(normalizePackageName('my.package')).toBe('mypackage')
    })

    it('removes js/node suffixes', () => {
      expect(normalizePackageName('lodash-js')).toBe('lodash')
      expect(normalizePackageName('lodashjs')).toBe('lodash')
      expect(normalizePackageName('lodash-node')).toBe('lodash')
    })

    it('removes js/node prefixes', () => {
      expect(normalizePackageName('js-yaml')).toBe('yaml')
      expect(normalizePackageName('node-fetch')).toBe('fetch')
    })

    it('handles scoped packages', () => {
      expect(normalizePackageName('@scope/my-package')).toBe('mypackage')
      expect(normalizePackageName('@vue/core')).toBe('core')
    })

    it('handles edge cases', () => {
      expect(normalizePackageName('js')).toBe('')
      expect(normalizePackageName('node')).toBe('')
    })
  })

  describe('levenshteinDistance', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshteinDistance('hello', 'hello')).toBe(0)
    })

    it('returns correct distance for single character changes', () => {
      expect(levenshteinDistance('hello', 'hallo')).toBe(1)
      expect(levenshteinDistance('hello', 'hell')).toBe(1)
      expect(levenshteinDistance('hello', 'helloo')).toBe(1)
    })

    it('handles empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0)
      expect(levenshteinDistance('hello', '')).toBe(5)
      expect(levenshteinDistance('', 'hello')).toBe(5)
    })
  })

  describe('isValidNewPackageName', () => {
    it('validates correct package names', () => {
      expect(isValidNewPackageName('my-package')).toBe(true)
      expect(isValidNewPackageName('my_package')).toBe(true)
      expect(isValidNewPackageName('@scope/package')).toBe(true)
    })

    it('rejects invalid package names', () => {
      expect(isValidNewPackageName('.hidden')).toBe(false)
      expect(isValidNewPackageName('-invalid')).toBe(false)
      expect(isValidNewPackageName('UPPERCASE')).toBe(false)
      expect(isValidNewPackageName('has spaces')).toBe(false)
      expect(isValidNewPackageName('')).toBe(false)
    })
  })
})
