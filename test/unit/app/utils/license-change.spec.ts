import { describe, expect, it } from 'vitest'

/**
 * Tests for the license change detection logic used in app/pages/package/[[org]]/[name].vue.
 *
 * The `licenseChanged` computed detects when the license of the currently
 * viewed version differs from the package-level (latest) license, so an
 * amber "changed" badge can be shown to alert users.
 */

type LicenseValue = string | { type?: string } | undefined | null

function normalize(l: LicenseValue): string {
  if (!l) return ''
  return typeof l === 'string' ? l : (l as { type?: string })?.type ?? ''
}

function licenseChanged(
  currentLicense: LicenseValue,
  packageLicense: LicenseValue,
): boolean {
  if (!currentLicense || !packageLicense) return false
  return normalize(currentLicense) !== normalize(packageLicense)
}

describe('licenseChanged detection', () => {
  it('returns false when both licenses are the same string', () => {
    expect(licenseChanged('MIT', 'MIT')).toBe(false)
  })

  it('returns true when a non-latest version has a different license', () => {
    // e.g. old version had GPL, latest has MIT
    expect(licenseChanged('GPL-2.0-only', 'MIT')).toBe(true)
  })

  it('returns false when current license is missing', () => {
    expect(licenseChanged(null, 'MIT')).toBe(false)
    expect(licenseChanged(undefined, 'MIT')).toBe(false)
  })

  it('returns false when package license is missing', () => {
    expect(licenseChanged('MIT', null)).toBe(false)
    expect(licenseChanged('MIT', undefined)).toBe(false)
  })

  it('returns false when both licenses are missing', () => {
    expect(licenseChanged(null, null)).toBe(false)
  })

  it('normalizes object-shaped licenses for comparison', () => {
    // Some old package.json use { type: "MIT" } instead of "MIT"
    expect(licenseChanged({ type: 'MIT' }, 'MIT')).toBe(false)
    expect(licenseChanged('MIT', { type: 'MIT' })).toBe(false)
    expect(licenseChanged({ type: 'GPL-2.0' }, { type: 'MIT' })).toBe(true)
  })

  it('returns true for Apache-2.0 changed to MIT (real-world case)', () => {
    expect(licenseChanged('Apache-2.0', 'MIT')).toBe(true)
  })

  it('returns false for complex SPDX expression that matches', () => {
    expect(licenseChanged('MIT OR Apache-2.0', 'MIT OR Apache-2.0')).toBe(false)
  })
})
