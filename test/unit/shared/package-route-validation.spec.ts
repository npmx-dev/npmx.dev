import { describe, expect, it } from 'vite-plus/test'
import { assertValidPackageRoute } from '#shared/utils/package-route-validation'
import { VALID_NAMES, VALID_VERSIONS } from '../../fixtures/package-coordinates'

type PackageRoute = Parameters<typeof assertValidPackageRoute>[0]

function page(name: string, version?: string): PackageRoute {
  const [org, short] = name.startsWith('@') ? name.split('/') : [undefined, name]
  return {
    path: `/package/${name}${version ? `/v/${version}` : ''}`,
    params: {
      ...(org ? { org } : {}),
      name: short!,
      ...(version ? { version } : {}),
    },
    query: {},
  }
}

const ACCEPTED: PackageRoute[] = [
  {
    path: '/package-timeline/nuxt/v/4.0.0',
    params: { packageName: 'nuxt', version: '4.0.0' },
    query: {},
  },
  {
    path: '/package-stats/@nuxt/kit/v/1.0.0',
    params: { org: '@nuxt', packageName: 'kit', version: '1.0.0' },
    query: {},
  },
  { path: '/package-changelog/vue/v/3.5.0', params: { name: 'vue', version: '3.5.0' }, query: {} },
  { path: '/changelog/vue', params: { name: 'vue' }, query: {} },
  {
    path: '/diff/nuxt/v/4.0.0...4.2.0',
    params: { packageName: 'nuxt', versionRange: '4.0.0...4.2.0' },
    query: {},
  },
  {
    path: '/diff/@nuxt/kit/v/1.0.0-beta.1+sha.abc...2.0.0',
    params: { org: '@nuxt', packageName: 'kit', versionRange: '1.0.0-beta.1+sha.abc...2.0.0' },
    query: {},
  },
  {
    path: '/diff/nuxt/v/latest...next',
    params: { packageName: 'nuxt', versionRange: 'latest...next' },
    query: {},
  },
  { path: '/org/nuxt', params: { org: 'nuxt' }, query: {} },
  { path: '/org/@nuxt', params: { org: '@nuxt' }, query: {} },
  {
    path: '/compare',
    params: {},
    query: { packages: 'vue@3.5.0,@nuxt/kit,__no_dependency__' },
  },
  { path: '/search', params: {}, query: { q: 'a name with spaces' } },
]

const REJECTED: PackageRoute[] = [
  { path: '/package/.env', params: { name: '.env' }, query: {} },
  { path: '/package/_next', params: { name: '_next' }, query: {} },
  { path: '/package/foo bar', params: { name: 'foo bar' }, query: {} },
  { path: '/package/@scope', params: { org: '@scope' }, query: {} },
  { path: '/package/vue/v/1.0.0 2', params: { name: 'vue', version: '1.0.0 2' }, query: {} },
  {
    path: '/package-timeline/vue/v/a b',
    params: { packageName: 'vue', version: 'a b' },
    query: {},
  },
  { path: '/diff/vue/v/1.0.0', params: { packageName: 'vue', versionRange: '1.0.0' }, query: {} },
  {
    path: '/diff/vue/v/1.0.0...',
    params: { packageName: 'vue', versionRange: '1.0.0...' },
    query: {},
  },
  {
    path: '/diff/vue/v/1.0.0..2.0.0',
    params: { packageName: 'vue', versionRange: '1.0.0..2.0.0' },
    query: {},
  },
  {
    path: '/diff/vue/v/1.0.0...2.0.0 beta',
    params: { packageName: 'vue', versionRange: '1.0.0...2.0.0 beta' },
    query: {},
  },
  { path: '/org/_bad', params: { org: '_bad' }, query: {} },
  { path: '/compare', params: {}, query: { packages: 'vue,foo bar' } },
  { path: '/compare', params: {}, query: { packages: ['vue', 'foo bar'] } },
]

function caught(route: PackageRoute): unknown {
  try {
    assertValidPackageRoute(route)
  } catch (error) {
    return error
  }
  return undefined
}

describe('assertValidPackageRoute', () => {
  it.each(VALID_NAMES)('accepts /package/%s', name => {
    expect(() => assertValidPackageRoute(page(name))).not.toThrow()
  })

  it.each(VALID_VERSIONS)('accepts version %s', version => {
    expect(() => assertValidPackageRoute(page('vue', version))).not.toThrow()
    expect(() => assertValidPackageRoute(page('@nuxt/kit', version))).not.toThrow()
  })

  it.each(ACCEPTED)('accepts $path', route => {
    expect(() => assertValidPackageRoute(route)).not.toThrow()
  })

  it.each(REJECTED)('rejects $path', route => {
    expect(caught(route)).toMatchObject({ statusCode: 404 })
  })
})
