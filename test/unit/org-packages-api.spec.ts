import { describe, expect, it } from 'vitest'

// Test the org name validation regex used in the API route
const NPM_ORG_NAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i

function isValidOrgName(name: string): boolean {
  return !!name && name.length <= 50 && NPM_ORG_NAME_RE.test(name)
}

describe('org packages API validation', () => {
  describe('org name validation', () => {
    it('accepts valid org names', () => {
      expect(isValidOrgName('nuxt')).toBe(true)
      expect(isValidOrgName('my-org')).toBe(true)
      expect(isValidOrgName('org123')).toBe(true)
      expect(isValidOrgName('a')).toBe(true)
      expect(isValidOrgName('a1')).toBe(true)
      expect(isValidOrgName('vue')).toBe(true)
      expect(isValidOrgName('types')).toBe(true)
    })

    it('rejects empty org names', () => {
      expect(isValidOrgName('')).toBe(false)
    })

    it('rejects org names that are too long', () => {
      const longName = 'a'.repeat(51)
      expect(isValidOrgName(longName)).toBe(false)
    })

    it('rejects org names starting with hyphen', () => {
      expect(isValidOrgName('-org')).toBe(false)
    })

    it('rejects org names ending with hyphen', () => {
      expect(isValidOrgName('org-')).toBe(false)
    })

    it('rejects org names with invalid characters', () => {
      expect(isValidOrgName('org;rm')).toBe(false)
      expect(isValidOrgName('org&&evil')).toBe(false)
      expect(isValidOrgName('$(whoami)')).toBe(false)
      expect(isValidOrgName('org space')).toBe(false)
      expect(isValidOrgName('org.name')).toBe(false)
      expect(isValidOrgName('org_name')).toBe(false)
      expect(isValidOrgName('org@name')).toBe(false)
      expect(isValidOrgName('org/name')).toBe(false)
    })

    it('handles single character org names', () => {
      expect(isValidOrgName('a')).toBe(true)
      expect(isValidOrgName('1')).toBe(true)
      expect(isValidOrgName('-')).toBe(false)
    })
  })
})
