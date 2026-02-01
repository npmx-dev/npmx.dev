import { describe, expect, it } from 'vitest'

import { buildScopeTeam } from '../../../../app/utils/npm'
import { validateScopeTeam } from '../../../../cli/src/npm-client'
import { getSpdxLicenseUrl } from '../../../../shared/utils/spdx'

describe('getSpdxLicenseUrl', () => {
  it('returns SPDX URL for valid license identifiers', () => {
    expect(getSpdxLicenseUrl('MIT')).toBe('https://spdx.org/licenses/MIT.html')
    expect(getSpdxLicenseUrl('ISC')).toBe('https://spdx.org/licenses/ISC.html')
    expect(getSpdxLicenseUrl('Apache-2.0')).toBe('https://spdx.org/licenses/Apache-2.0.html')
    expect(getSpdxLicenseUrl('GPL-3.0-only')).toBe('https://spdx.org/licenses/GPL-3.0-only.html')
    expect(getSpdxLicenseUrl('BSD-2-Clause')).toBe('https://spdx.org/licenses/BSD-2-Clause.html')
    expect(getSpdxLicenseUrl('GPL-3.0+')).toBe('https://spdx.org/licenses/GPL-3.0+.html')
  })

  it('trims whitespace from license identifiers', () => {
    expect(getSpdxLicenseUrl('  MIT  ')).toBe('https://spdx.org/licenses/MIT.html')
  })

  it('returns null for undefined or empty', () => {
    expect(getSpdxLicenseUrl(undefined)).toBeNull()
    expect(getSpdxLicenseUrl('')).toBeNull()
    expect(getSpdxLicenseUrl('   ')).toBeNull()
  })

  it('returns null for invalid license identifiers', () => {
    // Compound expressions are not in the SPDX list
    expect(getSpdxLicenseUrl('MIT OR Apache-2.0')).toBeNull()
    // Non-existent licenses
    expect(getSpdxLicenseUrl('INVALID-LICENSE')).toBeNull()
    expect(getSpdxLicenseUrl('Custom')).toBeNull()
  })
})

describe('buildScopeTeam', () => {
  it('constructs scope:team with @ prefix', () => {
    expect(buildScopeTeam('netlify', 'developers')).toBe('@netlify:developers')
    expect(buildScopeTeam('nuxt', 'core')).toBe('@nuxt:core')
  })

  it('strips existing @ prefix from orgName', () => {
    expect(buildScopeTeam('@netlify', 'developers')).toBe('@netlify:developers')
    expect(buildScopeTeam('@nuxt', 'core')).toBe('@nuxt:core')
  })

  it('produces format accepted by validateScopeTeam', () => {
    expect(() => validateScopeTeam(buildScopeTeam('netlify', 'developers'))).not.toThrow()
    expect(() => validateScopeTeam(buildScopeTeam('nuxt', 'core'))).not.toThrow()
    expect(() => validateScopeTeam(buildScopeTeam('my-org', 'my-team'))).not.toThrow()
  })
})
