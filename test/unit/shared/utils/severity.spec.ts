import { describe, expect, it } from 'vitest'
import {
  SEVERITY_COLORS,
  SEVERITY_TEXT_COLORS,
  SEVERITY_BADGE_COLORS,
  getHighestSeverity,
} from '../../../../shared/utils/severity'

describe('severity utils', () => {
  describe('SEVERITY_COLORS', () => {
    it('has colors for all severity levels', () => {
      expect(SEVERITY_COLORS.critical).toBeDefined()
      expect(SEVERITY_COLORS.high).toBeDefined()
      expect(SEVERITY_COLORS.moderate).toBeDefined()
      expect(SEVERITY_COLORS.low).toBeDefined()
      expect(SEVERITY_COLORS.unknown).toBeDefined()
    })

    it('critical has red colors', () => {
      expect(SEVERITY_COLORS.critical).toContain('red')
    })

    it('high has red colors', () => {
      expect(SEVERITY_COLORS.high).toContain('red')
    })

    it('moderate has orange colors', () => {
      expect(SEVERITY_COLORS.moderate).toContain('orange')
    })

    it('low has yellow colors', () => {
      expect(SEVERITY_COLORS.low).toContain('yellow')
    })
  })

  describe('SEVERITY_TEXT_COLORS', () => {
    it('has text colors for all severity levels', () => {
      expect(SEVERITY_TEXT_COLORS.critical).toContain('text-')
      expect(SEVERITY_TEXT_COLORS.high).toContain('text-')
      expect(SEVERITY_TEXT_COLORS.moderate).toContain('text-')
      expect(SEVERITY_TEXT_COLORS.low).toContain('text-')
      expect(SEVERITY_TEXT_COLORS.unknown).toContain('text-')
    })
  })

  describe('SEVERITY_BADGE_COLORS', () => {
    it('has badge colors for all severity levels', () => {
      expect(SEVERITY_BADGE_COLORS.critical).toBeDefined()
      expect(SEVERITY_BADGE_COLORS.high).toBeDefined()
      expect(SEVERITY_BADGE_COLORS.moderate).toBeDefined()
      expect(SEVERITY_BADGE_COLORS.low).toBeDefined()
      expect(SEVERITY_BADGE_COLORS.unknown).toBeDefined()
    })
  })

  describe('getHighestSeverity', () => {
    it('returns critical when critical count > 0', () => {
      expect(getHighestSeverity({ critical: 1, high: 0, moderate: 0, low: 0 })).toBe('critical')
    })

    it('returns high when high is highest', () => {
      expect(getHighestSeverity({ critical: 0, high: 2, moderate: 1, low: 0 })).toBe('high')
    })

    it('returns moderate when moderate is highest', () => {
      expect(getHighestSeverity({ critical: 0, high: 0, moderate: 3, low: 1 })).toBe('moderate')
    })

    it('returns low when only low', () => {
      expect(getHighestSeverity({ critical: 0, high: 0, moderate: 0, low: 5 })).toBe('low')
    })

    it('returns unknown when all counts are 0', () => {
      expect(getHighestSeverity({ critical: 0, high: 0, moderate: 0, low: 0 })).toBe('unknown')
    })

    it('returns unknown for empty object', () => {
      expect(getHighestSeverity({})).toBe('unknown')
    })

    it('prioritizes critical over all others', () => {
      expect(getHighestSeverity({ critical: 1, high: 10, moderate: 20, low: 30 })).toBe('critical')
    })

    it('handles missing keys gracefully', () => {
      expect(getHighestSeverity({ high: 1 })).toBe('high')
      expect(getHighestSeverity({ moderate: 1 })).toBe('moderate')
      expect(getHighestSeverity({ low: 1 })).toBe('low')
    })
  })
})
