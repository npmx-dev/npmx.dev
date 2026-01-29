import { describe, expect, it } from 'vitest'
import { isValidSpdxLicense, getSpdxLicenseUrl, parseLicenseExpression } from '#shared/utils/spdx'

describe('spdx utilities', () => {
  describe('isValidSpdxLicense', () => {
    it('returns true for valid SPDX licenses', () => {
      expect(isValidSpdxLicense('MIT')).toBe(true)
      expect(isValidSpdxLicense('Apache-2.0')).toBe(true)
      expect(isValidSpdxLicense('GPL-3.0-only')).toBe(true)
      expect(isValidSpdxLicense('BSD-2-Clause')).toBe(true)
      expect(isValidSpdxLicense('ISC')).toBe(true)
    })

    it('returns false for invalid licenses', () => {
      expect(isValidSpdxLicense('CustomLicense')).toBe(false)
      expect(isValidSpdxLicense('INVALID')).toBe(false)
      expect(isValidSpdxLicense('')).toBe(false)
    })

    it('is case-sensitive', () => {
      expect(isValidSpdxLicense('mit')).toBe(false)
      expect(isValidSpdxLicense('Mit')).toBe(false)
      expect(isValidSpdxLicense('MIT')).toBe(true)
    })
  })

  describe('getSpdxLicenseUrl', () => {
    it('returns URL for valid SPDX licenses', () => {
      expect(getSpdxLicenseUrl('MIT')).toBe('https://spdx.org/licenses/MIT.html')
      expect(getSpdxLicenseUrl('Apache-2.0')).toBe('https://spdx.org/licenses/Apache-2.0.html')
    })

    it('returns null for invalid licenses', () => {
      expect(getSpdxLicenseUrl('CustomLicense')).toBeNull()
      expect(getSpdxLicenseUrl('INVALID')).toBeNull()
    })

    it('returns null for undefined or empty', () => {
      expect(getSpdxLicenseUrl(undefined)).toBeNull()
      expect(getSpdxLicenseUrl('')).toBeNull()
    })

    it('trims whitespace', () => {
      expect(getSpdxLicenseUrl('  MIT  ')).toBe('https://spdx.org/licenses/MIT.html')
    })
  })

  describe('parseLicenseExpression', () => {
    describe('single licenses', () => {
      it('parses a single valid license', () => {
        const tokens = parseLicenseExpression('MIT')
        expect(tokens).toEqual([
          { type: 'license', value: 'MIT', url: 'https://spdx.org/licenses/MIT.html' },
        ])
      })

      it('parses a single invalid license without URL', () => {
        const tokens = parseLicenseExpression('CustomLicense')
        expect(tokens).toEqual([{ type: 'license', value: 'CustomLicense', url: undefined }])
      })
    })

    describe('OR expressions', () => {
      it('parses "MIT OR Apache-2.0"', () => {
        const tokens = parseLicenseExpression('MIT OR Apache-2.0')
        expect(tokens).toEqual([
          { type: 'license', value: 'MIT', url: 'https://spdx.org/licenses/MIT.html' },
          { type: 'operator', value: 'OR' },
          {
            type: 'license',
            value: 'Apache-2.0',
            url: 'https://spdx.org/licenses/Apache-2.0.html',
          },
        ])
      })

      it('parses triple OR expression', () => {
        const tokens = parseLicenseExpression('BSD-2-Clause OR MIT OR Apache-2.0')
        expect(tokens).toHaveLength(5)
        expect(tokens.filter(t => t.type === 'license')).toHaveLength(3)
        expect(tokens.filter(t => t.type === 'operator')).toHaveLength(2)
      })
    })

    describe('AND expressions', () => {
      it('parses "MIT AND Zlib"', () => {
        const tokens = parseLicenseExpression('MIT AND Zlib')
        expect(tokens).toEqual([
          { type: 'license', value: 'MIT', url: 'https://spdx.org/licenses/MIT.html' },
          { type: 'operator', value: 'AND' },
          { type: 'license', value: 'Zlib', url: 'https://spdx.org/licenses/Zlib.html' },
        ])
      })
    })

    describe('WITH expressions', () => {
      it('parses license with exception', () => {
        const tokens = parseLicenseExpression('GPL-2.0-only WITH Classpath-exception-2.0')
        expect(tokens).toHaveLength(3)
        expect(tokens[0]).toEqual({
          type: 'license',
          value: 'GPL-2.0-only',
          url: 'https://spdx.org/licenses/GPL-2.0-only.html',
        })
        expect(tokens[1]).toEqual({ type: 'operator', value: 'WITH' })
        // Exception identifiers are not valid licenses
        expect(tokens[2]?.type).toBe('license')
        expect(tokens[2]?.value).toBe('Classpath-exception-2.0')
      })
    })

    describe('parenthesized expressions', () => {
      it('strips parentheses from "(MIT OR Apache-2.0)"', () => {
        const tokens = parseLicenseExpression('(MIT OR Apache-2.0)')
        expect(tokens).toHaveLength(3)
        expect(tokens.map(t => t.value)).toEqual(['MIT', 'OR', 'Apache-2.0'])
      })

      it('strips parentheses from nested expression', () => {
        const tokens = parseLicenseExpression('((MIT))')
        expect(tokens).toHaveLength(1)
        expect(tokens[0]?.value).toBe('MIT')
      })
    })

    describe('mixed valid and invalid', () => {
      it('handles mix of valid and invalid licenses', () => {
        const tokens = parseLicenseExpression('MIT OR CustomLicense')
        expect(tokens).toHaveLength(3)
        expect(tokens[0]?.url).toBe('https://spdx.org/licenses/MIT.html')
        expect(tokens[2]?.url).toBeUndefined()
      })
    })

    describe('real-world examples', () => {
      it('handles rc package: (BSD-2-Clause OR MIT OR Apache-2.0)', () => {
        const tokens = parseLicenseExpression('(BSD-2-Clause OR MIT OR Apache-2.0)')
        const licenses = tokens.filter(t => t.type === 'license')
        expect(licenses).toHaveLength(3)
        expect(licenses.map(l => l.value)).toEqual(['BSD-2-Clause', 'MIT', 'Apache-2.0'])
        expect(licenses.every(l => l.url)).toBe(true)
      })

      it('handles jszip package: (MIT OR GPL-3.0-or-later)', () => {
        const tokens = parseLicenseExpression('(MIT OR GPL-3.0-or-later)')
        const licenses = tokens.filter(t => t.type === 'license')
        expect(licenses).toHaveLength(2)
        expect(licenses.every(l => l.url)).toBe(true)
      })

      it('handles pako package: (MIT AND Zlib)', () => {
        const tokens = parseLicenseExpression('(MIT AND Zlib)')
        expect(tokens).toHaveLength(3)
        expect(tokens[1]?.value).toBe('AND')
      })

      it('handles complex expression: Apache-2.0 WITH LLVM-exception', () => {
        const tokens = parseLicenseExpression('Apache-2.0 WITH LLVM-exception')
        expect(tokens).toHaveLength(3)
        expect(tokens[0]?.value).toBe('Apache-2.0')
        expect(tokens[1]?.value).toBe('WITH')
        expect(tokens[2]?.value).toBe('LLVM-exception')
      })
    })

    describe('edge cases', () => {
      it('handles empty string', () => {
        const tokens = parseLicenseExpression('')
        expect(tokens).toEqual([])
      })

      it('handles whitespace only', () => {
        const tokens = parseLicenseExpression('   ')
        expect(tokens).toEqual([])
      })

      it('handles extra whitespace between tokens', () => {
        const tokens = parseLicenseExpression('MIT    OR    Apache-2.0')
        expect(tokens).toHaveLength(3)
        expect(tokens.map(t => t.value)).toEqual(['MIT', 'OR', 'Apache-2.0'])
      })

      it('handles license IDs with dots and plus signs', () => {
        const tokens = parseLicenseExpression('GPL-2.0+')
        expect(tokens[0]?.value).toBe('GPL-2.0+')
      })
    })
  })
})
