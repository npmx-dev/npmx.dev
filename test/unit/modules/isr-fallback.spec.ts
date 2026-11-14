import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('nuxt/kit', () => ({
  defineNuxtModule: <T>(module: T) => module,
}))

import { addCrawlerFunction } from '../../../modules/isr-fallback'

describe('addCrawlerFunction', () => {
  let dir: string
  const humanRoute = {
    src: '(?<__isr_route>/package/(?:.*))',
    dest: '/package/[...]-isr?__isr_route=$__isr_route',
  }
  const prerenderConfig = {
    expiration: 300,
    fallback: 'spa.prerender-fallback.html',
    allowQuery: ['activeTab', '__isr_route'],
  }

  const readJSON = (path: string) => JSON.parse(readFileSync(resolve(dir, path), 'utf-8'))

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'isr-fallback-'))
    mkdirSync(resolve(dir, 'functions/package'), { recursive: true })
    mkdirSync(resolve(dir, 'functions/__fallback.func'))
    writeFileSync(
      resolve(dir, 'functions/package/[...]-isr.prerender-config.json'),
      JSON.stringify(prerenderConfig),
    )
    writeFileSync(
      resolve(dir, 'config.json'),
      JSON.stringify({ routes: [{ handle: 'filesystem' }, humanRoute, { src: '/(.*)' }] }),
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('adds a package page function without a fallback', () => {
    addCrawlerFunction(dir)

    const { fallback: _, ...expected } = prerenderConfig
    expect(readJSON('functions/package/[...]-isr-crawler.prerender-config.json')).toEqual(expected)
    expect(readJSON('functions/package/[...]-isr.prerender-config.json')).toEqual(prerenderConfig)
    expect(realpathSync(resolve(dir, 'functions/package/[...]-isr-crawler.func'))).toBe(
      realpathSync(resolve(dir, 'functions/__fallback.func')),
    )
  })

  it('routes crawler user agents to it and leaves other requests on the fallback', () => {
    addCrawlerFunction(dir)

    const { routes } = readJSON('config.json') as {
      routes: Array<{ dest?: string; has?: Array<{ value: string }> }>
    }
    expect(routes).toHaveLength(4)
    expect(routes[2]).toEqual(humanRoute)

    const select = (userAgent: string) =>
      routes
        .slice(1, 3)
        .find(route => !route.has || route.has.every(c => new RegExp(c.value).test(userAgent)))
        ?.dest

    for (const userAgent of [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'facebookexternalhit/1.1',
      'Mozilla/5.0 (compatible; Yahoo! Slurp)',
    ]) {
      expect(select(userAgent)).toBe('/package/[...]-isr-crawler?__isr_route=$__isr_route')
    }
    expect(
      select(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      ),
    ).toBe(humanRoute.dest)
  })

  it('throws when the package page route is missing', () => {
    writeFileSync(resolve(dir, 'config.json'), JSON.stringify({ routes: [] }))
    expect(() => addCrawlerFunction(dir)).toThrow(/could not find the route/)
  })
})
