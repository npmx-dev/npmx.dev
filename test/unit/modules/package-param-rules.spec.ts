import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import validatePackageName from 'validate-npm-package-name'
import * as v from 'valibot'
import { VersionSchema } from '#shared/schemas/package'
import { INVALID_URLS, VALID_NAMES, VALID_URLS } from '../../fixtures/package-coordinates'

vi.mock('nuxt/kit', () => ({
  defineNuxtModule: <T>(module: T) => module,
}))

import { addInvalidPackageRoutes, invalidPackageRoutes } from '../../../modules/package-param-rules'

interface VercelRoute {
  src?: string
  dest?: string
  handle?: string
  status?: number
  headers?: Record<string, string>
}

const isrRoute = (path: string, dest: string): VercelRoute => ({
  src: `^(?<__isr_route>${path})$`,
  dest: `${dest}?__isr_route=$__isr_route`,
})

/** The shape of a Vercel build config around the package routes, without a real build. */
function buildConfig(): { routes: VercelRoute[] } {
  return {
    routes: [
      { src: '^(?:/(.*))?$', headers: { 'X-Frame-Options': 'DENY' }, continue: true },
      { handle: 'filesystem' },
      isrRoute('/package(?:/(.*))?', '/package/[...]-isr'),
      isrRoute('/api/registry/packument(?:/(.*))?', '/api/registry/packument/[...]-isr'),
      isrRoute('/api/registry/timeline(?:/(.*))?', '/api/registry/timeline/[...]-isr'),
      isrRoute('/api/registry/readme(?:/(.*))?', '/api/registry/readme/[...]-isr'),
      isrRoute('/api/registry/package-meta(?:/(.*))?', '/api/registry/package-meta/[...]-isr'),
      isrRoute('/api/social/likes-evolution(?:/(.*))?', '/api/social/likes-evolution/[...]-isr'),
      isrRoute('/api/changelog/info(?:/(.*))?', '/api/changelog/info/[...]-isr'),
      isrRoute('/api(?:/(.*))?', '/api/[...]-isr'),
      isrRoute('/skills(?:/(.*))?', '/skills/[...]-isr'),
      isrRoute('/[^/]+\\.well-known/skills(?:/(.*))?', '/[pkg]/.well-known/skills/[...]-isr'),
      isrRoute(
        '/[^/]+/[^/]+\\.well-known/skills(?:/(.*))?',
        '/[scope]/[pkg]/.well-known/skills/[...]-isr',
      ),
      { src: '/(.*)', dest: '/__fallback' },
    ],
  }
}

type Resolution =
  | { kind: 'function'; dest: string; index: number }
  | { kind: 'status'; status: number; headers: Record<string, string>; index: number }

/** Names covering every error and warning `validate-npm-package-name` reports. */
const CANDIDATE_NAMES = [
  // Errors: a leading period, hyphen or underscore, spaces, the exclusion list, and any
  // character that is not URL-safe.
  '.env',
  '.',
  '..',
  '_next',
  '-',
  '--',
  '-x',
  ' leading',
  'trailing ',
  'node_modules',
  'favicon.ico',
  'foo bar',
  'foo#bar',
  'foo@bar',
  'foo+bar',
  'foo|bar',
  'foo:bar',
  'foo,bar',
  '@scope/.hidden',
  '%2E%2E',
  // Warnings only, so still served.
  'JSONStream',
  'Base64',
  'foo~bar',
  "it's-a-name",
  'foo(bar)',
  'http',
  'a'.repeat(214),
  'a'.repeat(215),
  '%61'.repeat(80),
  // Valid: a leading `-` or `_` is only checked on the whole name.
  '@scope/pkg',
  '@scope/-x',
  '@scope/_x',
  '@_scope/pkg',
  '@.scope/pkg',
  'a..b',
  '@scope/pkg.',
  '@scope/..',
  '@scope',
  // Encoded forms of the same.
  '@scope%2Fpkg',
  '@scope%2F.hidden',
  '@scope%2F_x',
  '@scope%2F-x',
]

/** Versions, dist-tags and `from...to` ranges. */
const CANDIDATE_VERSIONS = [
  '1.0.0',
  '1.0.0-beta.1+sha.abc',
  'latest',
  'next',
  '1.0.0...2.0.0',
  '1.0.0-beta.1+sha.abc...2.0.0',
  'latest...next',
  'canary!',
  "rc~(1)*'",
  `1.0.0+${'a'.repeat(125)}...2.0.0+${'b'.repeat(125)}`,
  '1.0.0 beta',
  '1.0.0%20beta',
  '1.0.0;rm',
  "1.0.0'",
  'a'.repeat(300),
  `1.0.0-${'%61'.repeat(90)}`,
]

/** Walks the routes the way Vercel does: first match that does not `continue` wins. */
function resolveRequest(routes: VercelRoute[], url: string): Resolution | undefined {
  const pathname = url.split('?')[0]!
  for (const [index, route] of routes.entries()) {
    if (route.handle || !route.src) {
      continue
    }
    if (!new RegExp(route.src).test(pathname)) {
      continue
    }
    if (route.dest) {
      return { kind: 'function', dest: route.dest, index }
    }
    if (route.status) {
      return { kind: 'status', status: route.status, headers: route.headers ?? {}, index }
    }
  }
  return undefined
}

describe('package name and version edge rules', () => {
  let dir: string

  const configPath = () => resolve(dir, 'config.json')
  const routes = () =>
    (JSON.parse(readFileSync(configPath(), 'utf-8')) as { routes: VercelRoute[] }).routes

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'package-param-rules-'))
    writeFileSync(configPath(), JSON.stringify(buildConfig(), null, 2))
    addInvalidPackageRoutes(configPath())
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('mounts the rules in front of every function route', () => {
    const all = routes()
    const firstFunction = all.findIndex(route => route.dest)
    const rules = invalidPackageRoutes()

    expect(all).toHaveLength(buildConfig().routes.length + rules.length)
    expect(all.slice(firstFunction - rules.length, firstFunction).map(r => r.src)).toEqual(
      rules.map(route => route.src),
    )
    expect(all[firstFunction]?.dest).toContain('/package/[...]-isr')
  })

  it('answers with a CDN-cacheable 404', () => {
    for (const route of invalidPackageRoutes()) {
      expect(route.status).toBe(404)
      expect(route.headers).toEqual({ 'Cache-Control': 'public, max-age=3600, s-maxage=3600' })
    }
  })

  it('has a junk URL for every rule', () => {
    const pathname = (url: string) => url.split('?')[0]!
    const unmatched = invalidPackageRoutes().filter(
      route => !INVALID_URLS.some(url => new RegExp(route.src!).test(pathname(url))),
    )

    expect(unmatched.map(route => route.src)).toEqual([])
  })

  it('keeps every valid fixture name schema-valid', () => {
    const rejected = VALID_NAMES.filter(name => !validatePackageName(name).validForOldPackages)

    expect(rejected).toEqual([])
  })

  it('is never stricter than the package name schema', () => {
    const tooStrict = CANDIDATE_NAMES.filter(name => {
      const decoded = decodeURIComponent(name)
      if (decoded.length > 214) return false
      if (resolveRequest(routes(), `/package/${name}`)?.kind !== 'status') return false
      return validatePackageName(decoded).validForOldPackages
    })

    expect(tooStrict).toEqual([])
  })

  it('is never stricter than the version schema, ranges included', () => {
    const tooStrict = CANDIDATE_VERSIONS.filter(version => {
      const decoded = decodeURIComponent(version)
      if (decoded.split('...').some(endpoint => endpoint.length > 256)) return false
      if (resolveRequest(routes(), `/diff/vue/v/${version}`)?.kind !== 'status') return false
      return v.is(VersionSchema, decoded)
    })

    expect(tooStrict).toEqual([])
  })

  it.each(VALID_URLS)('sends %s to the function that serves it', url => {
    expect(resolveRequest(routes(), url)?.kind).toBe('function')
  })

  it.each(INVALID_URLS)('answers %s without running a function', url => {
    const result = resolveRequest(routes(), url)

    expect(result).toMatchObject({ kind: 'status', status: 404 })
    expect(result!.index).toBeLessThan(routes().findIndex(route => route.dest))
  })

  it('throws when the config has no function routes to insert before', () => {
    writeFileSync(configPath(), JSON.stringify({ routes: [{ handle: 'filesystem' }] }))
    expect(() => addInvalidPackageRoutes(configPath())).toThrow(/could not find the first function/)
  })
})
