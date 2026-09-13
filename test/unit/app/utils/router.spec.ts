import { describe, expect, it } from 'vitest'
import { docsRoute } from '~/utils/router'

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
