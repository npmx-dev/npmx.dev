import { describe, expect, it } from 'vitest'
import { normalizeLicense, parseDependencyVersion } from '#shared/utils/npm'
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

describe('parseDependencyVersion', () => {
  it('returns plain semver ranges without a name', () => {
    expect(parseDependencyVersion('^4.2.0')).toEqual({ name: null, range: '^4.2.0' })
    expect(parseDependencyVersion('1.0.0')).toEqual({ name: null, range: '1.0.0' })
    expect(parseDependencyVersion('*')).toEqual({ name: null, range: '*' })
    expect(parseDependencyVersion('latest')).toEqual({ name: null, range: 'latest' })
  })

  it('resolves unscoped npm: aliases', () => {
    expect(parseDependencyVersion('npm:string-width@^4.2.0')).toEqual({
      name: 'string-width',
      range: '^4.2.0',
    })
  })

  it('resolves scoped npm: aliases', () => {
    expect(parseDependencyVersion('npm:@scope/pkg@^1.0.0')).toEqual({
      name: '@scope/pkg',
      range: '^1.0.0',
    })
  })

  it('resolves npm: aliases without a range', () => {
    expect(parseDependencyVersion('npm:string-width')).toEqual({
      name: 'string-width',
      range: null,
    })
    expect(parseDependencyVersion('npm:@scope/pkg')).toEqual({ name: '@scope/pkg', range: null })
  })

  it('returns nothing resolvable for non-semver references', () => {
    for (const value of [
      'file:../foo',
      'link:../foo',
      'workspace:*',
      'git://github.com/user/repo.git',
      'git+ssh://git@github.com/user/repo.git',
      'git+https://github.com/user/repo.git',
      'github:user/repo',
      'http://example.com/pkg.tgz',
      'https://example.com/pkg.tgz',
      'user/repo',
    ]) {
      expect(parseDependencyVersion(value)).toEqual({ name: null, range: null })
    }
  })

  it('treats dist-tags that look like protocols as resolvable', () => {
    for (const tag of ['git', 'github', 'gitlab', 'http', 'https', 'file', 'next']) {
      expect(parseDependencyVersion(tag)).toEqual({ name: null, range: tag })
    }
  })
})
