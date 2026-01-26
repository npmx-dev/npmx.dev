import { describe, expect, it } from 'vitest'

import { buildScopeTeam } from '../../app/utils/npm'
import { validateScopeTeam } from '../../cli/src/npm-client'

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
