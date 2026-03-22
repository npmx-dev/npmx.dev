import { describe, expect, it } from 'vitest'
import { parseNpmAlias } from '~/utils/npm/alias'

describe('parseNpmAlias', () => {
  it('returns null for a regular semver range (not an alias)', () => {
    expect(parseNpmAlias('^1.0.0')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseNpmAlias('')).toBeNull()
  })

  it('returns null for a plain version number', () => {
    expect(parseNpmAlias('1.2.3')).toBeNull()
  })

  it('returns null for a workspace protocol', () => {
    expect(parseNpmAlias('workspace:*')).toBeNull()
  })

  it('parses a simple alias with version range', () => {
    expect(parseNpmAlias('npm:real-pkg@^1.0.0')).toEqual({
      name: 'real-pkg',
      range: '^1.0.0',
    })
  })

  it('parses a scoped package alias', () => {
    expect(parseNpmAlias('npm:@scope/pkg@^1.0.0')).toEqual({
      name: '@scope/pkg',
      range: '^1.0.0',
    })
  })

  it('parses an alias without a version range', () => {
    expect(parseNpmAlias('npm:real-pkg')).toEqual({
      name: 'real-pkg',
      range: '',
    })
  })

  it('parses an alias with an exact version', () => {
    expect(parseNpmAlias('npm:real-pkg@2.0.0')).toEqual({
      name: 'real-pkg',
      range: '2.0.0',
    })
  })

  it('parses a scoped package alias without version', () => {
    expect(parseNpmAlias('npm:@scope/pkg')).toEqual({
      name: '@scope/pkg',
      range: '',
    })
  })

  it('strips the npm: prefix correctly', () => {
    const result = parseNpmAlias('npm:lodash@^4.0.0')
    expect(result).not.toBeNull()
    expect(result!.name).toBe('lodash')
    expect(result!.name).not.toContain('npm:')
  })
})
