import { describe, expect, it } from 'vite-plus/test'
import { dependencyVersionRoute, docsRoute, packageRoute } from '~/utils/router'

describe('dependencyVersionRoute', () => {
  it.each(['^1.0.6', '1.2.3', 'latest'])('links %s to its version page', spec => {
    expect(dependencyVersionRoute('react-native-svg', spec)).toEqual(
      packageRoute('react-native-svg', spec),
    )
  })

  it('links an npm alias to the version of the real package', () => {
    expect(dependencyVersionRoute('string-width', 'npm:string-width@^4.2.0')).toEqual(
      packageRoute('string-width', '^4.2.0'),
    )
  })

  it.each([
    [
      'github:cwnicoletti/react-native-progress',
      'https://github.com/cwnicoletti/react-native-progress',
    ],
    ['git+https://github.com/npm/cli.git', 'https://github.com/npm/cli'],
    ['npm/cli', 'https://github.com/npm/cli'],
    ['gitlab:user/repo', 'https://gitlab.com/user/repo'],
  ])('links the git dependency %s to its repo', (spec, repoUrl) => {
    expect(dependencyVersionRoute('pkg', spec)).toBe(repoUrl)
  })

  it('links a tarball dependency to its URL', () => {
    expect(dependencyVersionRoute('pkg', 'https://example.com/pkg.tgz')).toBe(
      'https://example.com/pkg.tgz',
    )
  })

  it.each(['file:../local', 'link:../local', 'workspace:*'])('has no link for %s', spec => {
    expect(dependencyVersionRoute('pkg', spec)).toBeUndefined()
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
