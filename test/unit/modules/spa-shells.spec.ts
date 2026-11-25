import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'

vi.mock('nuxt/kit', () => ({
  defineNuxtModule: <T>(module: T) => module,
}))

import {
  addSpaShellRoutes,
  CLIENT_ONLY_ROUTES,
  routeToVercelSrc,
} from '../../../modules/spa-shells'

const isClientOnly = (path: string) =>
  CLIENT_ONLY_ROUTES.some(route => new RegExp(routeToVercelSrc(route)).test(path))

describe('CLIENT_ONLY_ROUTES', () => {
  it.each([
    '/package-code/vue/v/3.5.13',
    '/package-code/vue/v/3.5.13/dist/vue.cjs.js',
    '/package-code/@nuxt/kit/v/4.2.0/dist/index.mjs',
    '/package/code/vue/v/3.5.13/package.json',
    '/package/code/@nuxt/kit/v/4.2.0',
  ])('renders %s client-side', path => {
    expect(isClientOnly(path)).toBe(true)
  })

  it.each([
    '/package/code',
    '/package/code/v/1.0.0',
    '/package/vue/v/3.5.13',
    '/package/@nuxt/kit',
    '/package-codex/vue/v/1.0.0',
  ])('server-renders %s', path => {
    expect(isClientOnly(path)).toBe(false)
  })
})

describe('addSpaShellRoutes', () => {
  let dir: string
  const isrRoute = { src: '^/a(?:/(.*))?$', dest: '/a/[...]-isr' }

  const readConfig = () =>
    JSON.parse(readFileSync(resolve(dir, 'config.json'), 'utf-8')) as {
      routes: Array<Record<string, unknown>>
    }

  beforeEach(() => {
    dir = mkdtempSync(resolve(tmpdir(), 'spa-shells-'))
    mkdirSync(resolve(dir, 'static'), { recursive: true })
    writeFileSync(
      resolve(dir, 'static/_spa.html'),
      '<div id="__nuxt"></div><script type="application/json" data-ssr="false" id="__NUXT_DATA__">[]</script>',
    )
    writeFileSync(
      resolve(dir, 'config.json'),
      JSON.stringify({
        routes: [
          { src: '^/code(?:/(.*))?$', headers: { 'X-Robots-Tag': 'noindex' }, continue: true },
          { handle: 'filesystem' },
          isrRoute,
          { src: '/(.*)', dest: '/__fallback' },
        ],
      }),
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('rewrites to the shell straight after the filesystem handler', () => {
    addSpaShellRoutes(dir, '/_spa.html', ['/code/**', '/a/:name/v/**'])

    const { routes } = readConfig()
    expect(routes.slice(1, 4)).toEqual([
      { handle: 'filesystem' },
      { src: '^/code(?:/.*)?$', dest: '/_spa.html' },
      { src: '^/a/[^/]+/v(?:/.*)?$', dest: '/_spa.html' },
    ])
    expect(routes[4]).toEqual(isrRoute)
  })

  it('throws when the shell was server-rendered', () => {
    writeFileSync(resolve(dir, 'static/_spa.html'), '<script data-ssr="true"></script>')
    expect(() => addSpaShellRoutes(dir, '/_spa.html', ['/code/**'])).toThrow(
      /not a client-only shell/,
    )
  })
})
