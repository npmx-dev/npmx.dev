import { describe, expect, it } from 'vitest'
import { normalizeLicense } from '#shared/utils/npm'
import type { PackumentLicense } from '#shared/types/npm-registry'

describe('normalizeLicense', () => {
  it('returns string licenses unchanged', () => {
    expect(normalizeLicense('MIT')).toBe('MIT')
  })

  it('extracts type from legacy object licenses', () => {
    expect(normalizeLicense({ type: 'Apache-2.0', url: 'https://example.com' })).toBe('Apache-2.0')
  })

  it('returns undefined for empty licenses', () => {
    expect(normalizeLicense(undefined)).toBeUndefined()
    expect(normalizeLicense('')).toBeUndefined()
  })

  it('returns undefined for malformed object licenses', () => {
    expect(normalizeLicense({} as PackumentLicense)).toBeUndefined()
    expect(normalizeLicense({ type: 123 } as unknown as PackumentLicense)).toBeUndefined()
  })
})
