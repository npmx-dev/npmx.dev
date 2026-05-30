import { describe, expect, it } from 'vitest'
import { normalizePackageLicense } from '#shared/utils/npm'
import type { PackumentLicense } from '#shared/types/npm-registry'

describe('normalizePackageLicense', () => {
  it('returns string licenses unchanged', () => {
    expect(normalizePackageLicense('MIT')).toBe('MIT')
  })

  it('extracts type from legacy object licenses', () => {
    expect(normalizePackageLicense({ type: 'Apache-2.0', url: 'https://example.com' })).toBe(
      'Apache-2.0',
    )
  })

  it('returns undefined for empty licenses', () => {
    expect(normalizePackageLicense(undefined)).toBeUndefined()
    expect(normalizePackageLicense('')).toBeUndefined()
  })

  it('returns undefined for malformed object licenses', () => {
    expect(normalizePackageLicense({} as PackumentLicense)).toBeUndefined()
    expect(normalizePackageLicense({ type: 123 } as unknown as PackumentLicense)).toBeUndefined()
  })
})
