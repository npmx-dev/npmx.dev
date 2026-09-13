import { describe, expect, it } from 'vitest'
import { dependenciesRoute, docsRoute } from '~/utils/router'

describe('dependenciesRoute', () => {
  it('generates dependencies route for unscoped package without sections', () => {
    expect(dependenciesRoute('vue', '3.4.0')).toEqual({
      name: 'dependencies',
      params: { path: ['vue', 'v', '3.4.0'] },
      query: undefined,
    })
  })

  it('generates dependencies route with single section as query', () => {
    expect(dependenciesRoute('vue', '3.4.0', 'devDependencies')).toEqual({
      name: 'dependencies',
      params: { path: ['vue', 'v', '3.4.0'] },
      query: { sections: 'devDependencies' },
    })
  })

  it('generates dependencies route with multiple sections as comma-separated query', () => {
    expect(dependenciesRoute('@nuxt/kit', '3.10.0', ['dependencies', 'peerDependencies'])).toEqual({
      name: 'dependencies',
      params: { path: ['@nuxt', 'kit', 'v', '3.10.0'] },
      query: { sections: 'dependencies,peerDependencies' },
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
