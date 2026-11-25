import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vite-plus/test'

interface HasField {
  type: 'header' | 'cookie' | 'query' | 'host'
  key?: string
  value?: string
}

interface VercelRoute {
  src?: string
  has?: HasField[]
  missing?: HasField[]
  mitigate?: { action: 'challenge' | 'deny' }
  continue?: boolean
}

const vercelJson = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../../../vercel.json'), 'utf-8'),
) as { routes: VercelRoute[] }

const mitigationRoutes = vercelJson.routes.filter(route => route.mitigate)

const CHROME =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const SAFARI_IOS =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1'
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0'

const FETCH = {
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'sec-fetch-site': 'same-origin',
}
const NODE_FETCH = { 'sec-fetch-mode': 'cors', 'accept-language': '*' }
const GITHUB_CAMO = 'github-camo (876de43e)'

/**
 * Vercel does not document whether a `has` value is matched against the whole header or
 * searched within it, so every expectation is checked under both readings.
 */
type MatchMode = 'anchored' | 'search'

function fieldMatches(field: HasField, headers: Record<string, string>, mode: MatchMode) {
  if (field.type !== 'header' || !field.key) {
    throw new Error(`unsupported condition in vercel.json: ${JSON.stringify(field)}`)
  }
  const actual = headers[field.key.toLowerCase()]
  if (actual === undefined) return false
  if (field.value === undefined) return true
  const pattern = mode === 'anchored' ? `^(?:${field.value})$` : field.value
  return new RegExp(pattern).test(actual)
}

function mitigation(path: string, headers: Record<string, string>, mode: MatchMode) {
  const normalisedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  for (const route of mitigationRoutes) {
    if (!new RegExp(route.src!).test(path)) continue
    if (!(route.has ?? []).every(field => fieldMatches(field, normalisedHeaders, mode))) continue
    if ((route.missing ?? []).some(field => fieldMatches(field, normalisedHeaders, mode))) continue
    return route.mitigate!.action
  }
  return undefined
}

const modes: MatchMode[] = ['anchored', 'search']

describe.each(modes)('vercel.json mitigation routes (%s header matching)', mode => {
  it('should only mitigate and never end routing', () => {
    expect(mitigationRoutes.length).toBeGreaterThan(0)
    for (const route of mitigationRoutes) {
      expect(route.continue).toBe(true)
      expect(route.mitigate?.action).toBe('challenge')
    }
  })

  it.each([CHROME, SAFARI_IOS, FIREFOX])('should let browser fetches through (%s)', userAgent => {
    for (const path of [
      '/api/registry/file/vue/v/3.5.0/package.json',
      '/api/registry/files/vue/v/3.5.0',
      '/api/registry/docs/vue/v/3.5.0',
    ]) {
      expect(mitigation(path, { 'user-agent': userAgent, ...FETCH }, mode)).toBeUndefined()
    }
  })

  it.each([
    '/api/registry/file/vue/v/3.5.0/package.json',
    '/api/registry/files/@nuxt/kit/v/3.0.0',
    '/api/registry/docs/vue/v/3.5.0',
  ])('should challenge %s without fetch metadata, whatever the user agent', path => {
    expect(mitigation(path, { 'user-agent': CHROME }, mode)).toBe('challenge')
    expect(mitigation(path, { 'user-agent': 'python-requests/2.32.3' }, mode)).toBe('challenge')
    expect(mitigation(path, { 'user-agent': 'node', ...NODE_FETCH }, mode)).toBe('challenge')
    expect(mitigation(path, {}, mode)).toBe('challenge')
  })

  it.each([
    '/_og/d/package/vue.png',
    '/api/registry/badge/version/vue',
    '/api/embed/downloads.svg',
    '/api/registry/packument/vue',
    '/api/opensearch/suggestions',
    '/api/auth/session',
    '/opensearch.xml',
    '/oauth-client-metadata.json',
    '/.well-known/jwks.json',
    '/.well-known/site.standard.publication',
    '/blog/rss.xml',
    '/blog/atom.xml',
    '/vue/.well-known/skills/index.json',
    '/@nuxt/kit/.well-known/skills/index.json',
    '/skills/vue/v/3.5.0',
    '/robots.txt',
    '/',
    '/about',
    '/blog/alpha-release',
    '/vue',
    '/package/vue',
    '/package-code/vue/v/3.5.0/package.json',
    '/package-docs/vue/v/3.5.0',
  ])('should never mitigate %s', path => {
    for (const headers of [
      { 'user-agent': CHROME },
      { 'user-agent': 'python-requests/2.32.3' },
      { 'user-agent': GITHUB_CAMO },
      {},
    ]) {
      expect(mitigation(path, headers, mode)).toBeUndefined()
    }
  })
})
