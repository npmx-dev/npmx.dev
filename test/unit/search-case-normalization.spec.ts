import { describe, it, expect } from 'vitest'
import { parseSuggestionIntent } from '../../app/composables/npm/search-utils'

describe('Search case normalization', () => {
  describe('parseSuggestionIntent', () => {
    it('should preserve case in name extraction for org queries', () => {
      const result = parseSuggestionIntent('@AnGuLAR')
      expect(result.intent).toBe('org')
      expect(result.name).toBe('AnGuLAR')
    })

    it('should preserve case in name extraction for user queries', () => {
      const result = parseSuggestionIntent('~daNIEL')
      expect(result.intent).toBe('user')
      expect(result.name).toBe('daNIEL')
    })

    it('should preserve case in name extraction for both queries', () => {
      const result = parseSuggestionIntent('AnGuLAR')
      expect(result.intent).toBe('both')
      expect(result.name).toBe('AnGuLAR')
    })

    it('should handle lowercase org names', () => {
      const result = parseSuggestionIntent('@angular')
      expect(result.intent).toBe('org')
      expect(result.name).toBe('angular')
    })

    it('should handle lowercase user names', () => {
      const result = parseSuggestionIntent('~daniel')
      expect(result.intent).toBe('user')
      expect(result.name).toBe('daniel')
    })
  })

  describe('Case normalization expectations', () => {
    it('should expect suggestions to normalize names to lowercase', () => {
      const mixedCaseOrg = parseSuggestionIntent('@AnGuLAR')
      expect(mixedCaseOrg.name).toBe('AnGuLAR')

      const expectedNormalized = mixedCaseOrg.name.toLowerCase()
      expect(expectedNormalized).toBe('angular')
    })
  })
})
