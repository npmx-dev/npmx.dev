import { describe, expect, it } from 'vitest'
import { getDevDependencySuggestion } from '../../../../shared/utils/dev-dependency'

describe('getDevDependencySuggestion', () => {
  it('suggests dev dependency for known tooling packages', () => {
    expect(getDevDependencySuggestion('eslint')).toEqual({
      recommended: true,
      reason: 'known-package',
    })
    expect(getDevDependencySuggestion('@types/node')).toEqual({
      recommended: true,
      reason: 'known-package',
    })
    expect(getDevDependencySuggestion('@typescript-eslint/parser')).toEqual({
      recommended: true,
      reason: 'known-package',
    })
  })

  it('suggests dev dependency from README install command hints', () => {
    const readme = '<p>Install with <code>npm install --save-dev some-tool</code></p>'

    expect(getDevDependencySuggestion('some-tool', readme)).toEqual({
      recommended: true,
      reason: 'readme-hint',
    })
  })

  it('suggests dev dependency from README --dev flag hints', () => {
    const readme = '<p><code>yarn add --dev some-tool</code></p>'

    expect(getDevDependencySuggestion('some-tool', readme)).toEqual({
      recommended: true,
      reason: 'readme-hint',
    })
  })

  it('suggests dev dependency from README deno -D hints', () => {
    const readme = '<p><code>deno add -D npm:some-tool</code></p>'

    expect(getDevDependencySuggestion('some-tool', readme)).toEqual({
      recommended: true,
      reason: 'readme-hint',
    })
  })

  it('does not suggest dev dependency for runtime packages without hints', () => {
    expect(getDevDependencySuggestion('react')).toEqual({
      recommended: false,
    })
  })

  it('does not suggest when README hint targets a different package', () => {
    const readme = '<p>Install with <code>yarn add -D bar</code></p>'

    expect(getDevDependencySuggestion('foo', readme)).toEqual({
      recommended: false,
    })
  })
})
