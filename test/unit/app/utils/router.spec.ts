import { describe, expect, it } from 'vitest'
import { diffRoute, docsRoute, packageRoute } from '~/utils/router'

describe('packageRoute', () => {
  describe('without version', () => {
    it('returns package route for unscoped package', () => {
      expect(packageRoute('react')).toEqual({
        name: 'package',
        params: { org: '', name: 'react' },
      })
    })

    it('returns package route for scoped package', () => {
      expect(packageRoute('@angular/core')).toEqual({
        name: 'package',
        params: { org: '@angular', name: 'core' },
      })
    })
  })

  describe('with exact version', () => {
    it('returns version route for unscoped package', () => {
      expect(packageRoute('react', '18.0.0')).toEqual({
        name: 'package-version',
        params: { org: '', name: 'react', version: '18.0.0' },
      })
    })

    it('returns version route for scoped package', () => {
      expect(packageRoute('@angular/core', '18.0.0')).toEqual({
        name: 'package-version',
        params: { org: '@angular', name: 'core', version: '18.0.0' },
      })
    })

    it('returns version route for prerelease version', () => {
      expect(packageRoute('vue', '3.5.0-beta.1')).toEqual({
        name: 'package-version',
        params: { org: '', name: 'vue', version: '3.5.0-beta.1' },
      })
    })
  })

  describe('with version range', () => {
    it('returns package route with semver query for caret range', () => {
      expect(packageRoute('react', '^18.0.0')).toEqual({
        name: 'package',
        params: { org: '', name: 'react' },
        query: { semver: '^18.0.0' },
        hash: '#versions',
      })
    })

    it('returns package route with semver query for tilde range', () => {
      expect(packageRoute('react', '~18.2.0')).toEqual({
        name: 'package',
        params: { org: '', name: 'react' },
        query: { semver: '~18.2.0' },
        hash: '#versions',
      })
    })

    it('returns package route with semver query for union range', () => {
      expect(packageRoute('@angular/core', '^18.0.0 || ^19.0.0 || ^20.0.0')).toEqual({
        name: 'package',
        params: { org: '@angular', name: 'core' },
        query: { semver: '^18.0.0 || ^19.0.0 || ^20.0.0' },
        hash: '#versions',
      })
    })

    it('returns package route with semver query for comparator range', () => {
      expect(packageRoute('typescript', '>15 <=16.0.2')).toEqual({
        name: 'package',
        params: { org: '', name: 'typescript' },
        query: { semver: '>15 <=16.0.2' },
        hash: '#versions',
      })
    })

    it('returns package route with semver query for wildcard', () => {
      expect(packageRoute('lodash', '*')).toEqual({
        name: 'package',
        params: { org: '', name: 'lodash' },
        query: { semver: '*' },
        hash: '#versions',
      })
    })

    it('returns package route with semver query for dist-tag', () => {
      expect(packageRoute('nuxt', 'latest')).toEqual({
        name: 'package',
        params: { org: '', name: 'nuxt' },
        query: { semver: 'latest' },
        hash: '#versions',
      })
    })
  })

  describe('with null/undefined version', () => {
    it('returns package route for null version', () => {
      expect(packageRoute('react', null)).toEqual({
        name: 'package',
        params: { org: '', name: 'react' },
      })
    })
  })
})

describe('diffRoute', () => {
  it('returns diff route for unscoped package', () => {
    expect(diffRoute('react', '17.0.0', '18.0.0')).toEqual({
      name: 'diff',
      params: { org: undefined, packageName: 'react', versionRange: '17.0.0...18.0.0' },
    })
  })

  it('returns diff route for scoped package', () => {
    expect(diffRoute('@angular/core', '17.0.0', '18.0.0')).toEqual({
      name: 'diff',
      params: { org: '@angular', packageName: 'core', versionRange: '17.0.0...18.0.0' },
    })
  })
})

describe('docsRoute', () => {
  it('emits a scoped name as two path segments (literal slash, not %2F)', () => {
    // A single "@org/name" segment would be URL-encoded to "@org%2Fname"; the
    // docs route must keep the scope slash literal by splitting it into two.
    expect(docsRoute('@vitest/pretty-format', '4.1.10')).toEqual({
      name: 'docs',
      params: { path: ['@vitest', 'pretty-format', 'v', '4.1.10'] },
    })
  })

  it('handles an unscoped name with a version', () => {
    expect(docsRoute('nuxt', '4.2.0')).toEqual({
      name: 'docs',
      params: { path: ['nuxt', 'v', '4.2.0'] },
    })
  })

  it('omits the version marker when no version is given', () => {
    expect(docsRoute('@vitest/pretty-format')).toEqual({
      name: 'docs',
      params: { path: ['@vitest', 'pretty-format'] },
    })
  })

  it('strips whitespace from the version', () => {
    expect(docsRoute('nuxt', ' 4.2.0 ')).toEqual({
      name: 'docs',
      params: { path: ['nuxt', 'v', '4.2.0'] },
    })
  })

  it('keeps a package literally named "v" separate from the version marker', () => {
    expect(docsRoute('v', '1.0.0')).toEqual({
      name: 'docs',
      params: { path: ['v', 'v', '1.0.0'] },
    })
  })

  it('handles a scoped package whose name is "v"', () => {
    expect(docsRoute('@org/v', '1.0.0')).toEqual({
      name: 'docs',
      params: { path: ['@org', 'v', 'v', '1.0.0'] },
    })
  })
})
