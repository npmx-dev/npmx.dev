import { describe, expect, it } from 'vitest'
import { parseSearchQuery } from '../../../../app/utils/search'

describe('parseSearchQuery', () => {
  it('parses unscoped package names', () => {
    expect(parseSearchQuery('nuxt')).toEqual({
      name: 'nuxt',
      specifier: 'nuxt',
      scope: undefined,
      version: undefined,
      trailing: '',
    })
  })

  it('parses scoped package names', () => {
    expect(parseSearchQuery('@nuxt/devtools')).toEqual({
      name: '@nuxt/devtools',
      specifier: 'devtools',
      scope: 'nuxt',
      version: undefined,
      trailing: '',
    })
  })

  it('parses unscoped package names with version', () => {
    expect(parseSearchQuery('nuxt@^4.0.0')).toEqual({
      name: 'nuxt',
      specifier: 'nuxt',
      scope: undefined,
      version: '^4.0.0',
      trailing: '',
    })
    expect(parseSearchQuery('next@15.3.0-canary.1')).toEqual({
      name: 'next',
      specifier: 'next',
      scope: undefined,
      version: '15.3.0-canary.1',
      trailing: '',
    })
  })

  it('parses scoped package names with version', () => {
    expect(parseSearchQuery('@nuxt/devtools@latest')).toEqual({
      name: '@nuxt/devtools',
      specifier: 'devtools',
      scope: 'nuxt',
      version: 'latest',
      trailing: '',
    })
  })

  it('returns trailing text', () => {
    expect(parseSearchQuery('nuxt keyword:frontend')).toEqual({
      name: 'nuxt',
      specifier: 'nuxt',
      scope: undefined,
      version: undefined,
      trailing: ' keyword:frontend',
    })
    expect(parseSearchQuery('@nuxt/devtools@latest keyword:devtools')).toEqual({
      name: '@nuxt/devtools',
      specifier: 'devtools',
      scope: 'nuxt',
      version: 'latest',
      trailing: ' keyword:devtools',
    })
  })
})
