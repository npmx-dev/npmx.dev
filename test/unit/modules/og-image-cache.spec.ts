import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createError, createEvent } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('nuxt/kit', () => ({
  createResolver: () => ({ resolve: (p: string) => p }),
  defineNuxtModule: <T>(module: T) => module,
}))

import ogImageCacheModule, {
  addOgImageEdgeRules,
  LEGACY_OG_CACHE_CONTROL,
  MISSING_STATIC_OG_CACHE_CONTROL,
  RESOLVER_OG_CACHE_CONTROL,
} from '../../../modules/og-image-cache'
import {
  handleOgImageError,
  isOgImagePath,
  OG_INVALID_CACHE_CONTROL,
  OG_NOT_FOUND_CACHE_CONTROL,
} from '../../../modules/runtime/server/og-image-error-handler'

function createMockEvent(path: string, initialHeaders: Record<string, string> = {}) {
  const req = new IncomingMessage(new Socket())
  req.url = path
  req.method = 'GET'
  const res = new ServerResponse(req)
  let body = ''
  const origEnd = res.end.bind(res)
  res.end = ((chunk?: unknown, ...rest: unknown[]) => {
    if (chunk !== undefined) {
      body += typeof chunk === 'string' ? chunk : Buffer.from(chunk as Uint8Array).toString('utf8')
    }
    return origEnd(chunk as never, ...(rest as []))
  }) as typeof res.end
  const event = createEvent(req, res)
  for (const [key, value] of Object.entries(initialHeaders)) {
    res.setHeader(key, value)
  }
  return { event, res, getBody: () => body }
}

describe('addOgImageEdgeRules', () => {
  let dir: string

  const readConfig = () =>
    JSON.parse(readFileSync(resolve(dir, 'config.json'), 'utf-8')) as {
      routes: Array<{
        handle?: string
        src?: string
        status?: number
        headers?: Record<string, string>
        continue?: boolean
      }>
    }

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'og-image-cache-'))
    writeFileSync(
      resolve(dir, 'config.json'),
      JSON.stringify({
        routes: [
          { src: '^/_og/s(?:/(.*))?$', headers: { 'cache-control': 'public, max-age=31536000' } },
          { handle: 'filesystem' },
          { src: '/_og/s(?:/(?:.*))?', dest: '/_og/s/[...]' },
        ],
      }),
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('inserts terminal edge rules for /_og/s, /_og/r, and /__og-image__ right after filesystem', () => {
    addOgImageEdgeRules(dir)

    const { routes } = readConfig()
    expect(routes).toHaveLength(6)
    expect(routes[1]).toEqual({ handle: 'filesystem' })
    expect(routes[2]).toEqual({
      src: '^/_og/s(?:/.*)?$',
      status: 404,
      headers: { 'cache-control': MISSING_STATIC_OG_CACHE_CONTROL },
      continue: false,
    })
    expect(routes[3]).toEqual({
      src: '^/_og/r(?:/.*|\\.png/?)?$',
      status: 404,
      headers: { 'cache-control': RESOLVER_OG_CACHE_CONTROL },
      continue: false,
    })
    expect(routes[4]).toEqual({
      src: '^/__og-image__(?:/.*)?$',
      status: 410,
      headers: { 'cache-control': LEGACY_OG_CACHE_CONTROL },
      continue: false,
    })
  })

  it('matches missing static, resolver, and legacy v5 OG paths without matching /_og/d', () => {
    addOgImageEdgeRules(dir)
    const { routes } = readConfig()
    const missingStaticRe = new RegExp(routes[2]!.src!)
    const resolverRe = new RegExp(routes[3]!.src!)
    const legacyRe = new RegExp(routes[4]!.src!)

    expect(missingStaticRe.test('/_og/s')).toBe(true)
    expect(missingStaticRe.test('/_og/s/o_deadbeef.png')).toBe(true)
    expect(missingStaticRe.test('/_og/d/c_Splash.takumi.png')).toBe(false)

    expect(resolverRe.test('/_og/r')).toBe(true)
    expect(resolverRe.test('/_og/r/package/vue')).toBe(true)
    expect(resolverRe.test('/_og/r.png')).toBe(true)
    expect(resolverRe.test('/_og/r.png/')).toBe(true)
    expect(resolverRe.test('/_og/rfoo')).toBe(false)
    expect(resolverRe.test('/_og/d/c_Splash.takumi.png')).toBe(false)

    expect(legacyRe.test('/__og-image__')).toBe(true)
    expect(legacyRe.test('/__og-image__/image/og.png')).toBe(true)
    expect(legacyRe.test('/__og-image__/static/package/vue/og.png')).toBe(true)
    expect(legacyRe.test('/package/vue')).toBe(false)
  })

  it('throws when the filesystem handle route is missing', () => {
    writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ routes: [] }))
    expect(() => addOgImageEdgeRules(dir)).toThrow(/filesystem/)
  })
})

function setupOgImageCacheModule(routeRules: Record<string, unknown> = {}) {
  const hooks = new Map<string, (arg?: unknown) => void>()
  const nuxt = {
    options: { routeRules },
    hook: (name: string, callback: (arg?: unknown) => void) => {
      hooks.set(name, callback)
    },
  }
  const definition = ogImageCacheModule as unknown as {
    setup: (options: object, nuxtArg: unknown) => void
  }
  definition.setup({}, nuxt)
  return { hooks, nuxt }
}

describe('og-image-cache module setup', () => {
  it('removes resolver route rules, strips resolver handlers, prepends errorHandler, and drops blanket /_og/d cache-control', () => {
    const { hooks, nuxt } = setupOgImageCacheModule({
      '/_og/r/**': { headers: { 'cache-control': 'public, max-age=86400' } },
      '/_og/r.png': { headers: { 'cache-control': 'public, max-age=86400' } },
      '/_og/s/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
    })

    hooks.get('modules:done')!()
    expect(nuxt.options.routeRules).not.toHaveProperty('/_og/r/**')
    expect(nuxt.options.routeRules).not.toHaveProperty('/_og/r.png')
    expect(nuxt.options.routeRules).toHaveProperty('/_og/s/**')

    const nitroConfig = {
      errorHandler: '/nuxt/error-handler',
      handlers: [
        { route: '/_og/d/**', handler: 'image' },
        { route: '/_og/r', handler: 'resolve' },
        { route: '/_og/r/**', handler: 'resolve' },
        { route: '/_og/r.png', handler: 'resolve' },
      ],
      routeRules: {
        '/_og/d/**': {
          headers: { 'cache-control': 'public, max-age=86400, immutable', 'x-custom': 'keep' },
        },
        '/other': { headers: { 'cache-control': 'public, max-age=60' } },
      },
    }

    hooks.get('nitro:config')!(nitroConfig)

    expect(nitroConfig.errorHandler).toEqual([
      './runtime/server/og-image-error-handler',
      '/nuxt/error-handler',
    ])
    expect(nitroConfig.handlers).toEqual([{ route: '/_og/d/**', handler: 'image' }])
    expect(nitroConfig.routeRules['/_og/d/**'].headers).toEqual({ 'x-custom': 'keep' })
    expect(nitroConfig.routeRules['/other'].headers['cache-control']).toBe('public, max-age=60')
  })

  it('removes empty headers object when cache-control was the only header on /_og/d/**', () => {
    const { hooks } = setupOgImageCacheModule()
    const nitroConfig: { routeRules: Record<string, { headers?: Record<string, string> }> } = {
      routeRules: {
        '/_og/d/**': { headers: { 'cache-control': 'public, max-age=86400, immutable' } },
      },
    }

    hooks.get('nitro:config')!(nitroConfig)

    expect(nitroConfig.routeRules['/_og/d/**']?.headers).toBeUndefined()
  })
})

describe('handleOgImageError', () => {
  it('detects /_og paths only', () => {
    expect(isOgImagePath('/_og')).toBe(true)
    expect(isOgImagePath('/_og/d/foo.png')).toBe(true)
    expect(isOgImagePath('/_og/r/package/vue')).toBe(true)
    expect(isOgImagePath('/_og-static-fonts/inter.ttf')).toBe(false)
    expect(isOgImagePath('/package/vue')).toBe(false)
  })

  it('ignores non-OG paths so Nuxt handles them normally', async () => {
    const { event } = createMockEvent('/package/nonexistent')
    await handleOgImageError(createError({ statusCode: 404 }), event)
    expect(event.handled).toBe(false)
  })

  it('maps 403 signature errors on /_og/d to cacheable 404 plain text without Vary', async () => {
    const { event, res, getBody } = createMockEvent('/_og/d/c_Splash.takumi.png', {
      vary: 'accept, sec-fetch-mode',
    })
    await handleOgImageError(
      createError({ statusCode: 403, statusMessage: 'Missing URL signature' }),
      event,
    )

    expect(event.handled).toBe(true)
    expect(res.statusCode).toBe(404)
    expect(res.getHeader('cache-control')).toBe(OG_INVALID_CACHE_CONTROL)
    expect(res.getHeader('content-type')).toBe('text/plain; charset=utf-8')
    expect(res.getHeader('vary')).toBeUndefined()
    expect(getBody()).toBe('Not Found')
  })

  it('maps 400 malformed requests on /_og/d to cacheable 404 plain text', async () => {
    const { event, res, getBody } = createMockEvent('/_og/d/o_1234.png')
    await handleOgImageError(createError({ statusCode: 400 }), event)

    expect(event.handled).toBe(true)
    expect(res.statusCode).toBe(404)
    expect(res.getHeader('cache-control')).toBe(OG_INVALID_CACHE_CONTROL)
    expect(getBody()).toBe('Not Found')
  })

  it('caches 404 responses on /_og/d for 5 minutes', async () => {
    const { event, res, getBody } = createMockEvent('/_og/d/c_Package.takumi,name_missing.png')
    await handleOgImageError(createError({ statusCode: 404 }), event)

    expect(event.handled).toBe(true)
    expect(res.statusCode).toBe(404)
    expect(res.getHeader('cache-control')).toBe(OG_NOT_FOUND_CACHE_CONTROL)
    expect(getBody()).toBe('Not Found')
  })

  it('does not cache 500 or 408 timeout errors', async () => {
    for (const statusCode of [500, 502, 408]) {
      const { event, res, getBody } = createMockEvent('/_og/d/c_Package.takumi,name_vue.png')
      await handleOgImageError(createError({ statusCode }), event)

      expect(event.handled).toBe(true)
      expect(res.statusCode).toBe(statusCode)
      expect(res.getHeader('cache-control')).toBe('no-store')
      expect(getBody()).toBe('Error')
    }
  })
})
