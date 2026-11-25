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
import { UNFURL_USER_AGENT_PATTERN } from '#shared/utils/unfurl'

const isClientOnly = (path: string) =>
  CLIENT_ONLY_ROUTES.some(route => new RegExp(routeToVercelSrc(route)).test(path))

describe('CLIENT_ONLY_ROUTES', () => {
  it.each([
    '/package-code/vue/v/3.5.13',
    '/package-code/vue/v/3.5.13/dist/vue.cjs.js',
    '/package-code/@nuxt/kit/v/4.2.0/dist/index.mjs',
    '/package/code/vue/v/3.5.13/package.json',
    '/package/code/@nuxt/kit/v/4.2.0',
    '/package-docs/ufo/v/1.6.3',
    '/package-docs/@nuxt/kit',
    '/docs/ufo',
    '/docs/ufo/v/1.6.3',
    '/package/docs/ufo/v/1.6.3',
    '/package/docs/@nuxt/kit/v/4.2.0',
    '/package-changelog/nuxt',
    '/package-changelog/nuxt/v/4.3.1',
    '/package-changelog/@nuxt/kit',
    '/package-changelog/@nuxt/kit/v/4.2.0',
    '/changelog/nuxt',
    '/changelog/nuxt/v/4.3.1',
    '/changelog/@nuxt/kit',
    '/changelog/@nuxt/kit/v/4.2.0',
  ])('renders %s client-side', path => {
    expect(isClientOnly(path)).toBe(true)
  })

  it.each([
    '/package/code',
    '/package/code/v/1.0.0',
    '/package/docs',
    '/package/docs/v/1.0.0',
    '/package/vue/v/3.5.13',
    '/package/@nuxt/kit',
    '/package-codex/vue/v/1.0.0',
    '/docs',
    '/docsearch',
    '/changelog',
    '/changelogs',
    '/package-changelogx/nuxt',
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
    const unfurl = [{ type: 'header', key: 'user-agent', value: UNFURL_USER_AGENT_PATTERN }]
    expect(routes.slice(1, 6)).toEqual([
      { handle: 'filesystem' },
      { src: '^/code(?:/.*)?$', dest: '/__fallback', has: unfurl },
      { src: '^/code(?:/.*)?$', dest: '/_spa.html' },
      { src: '^/a/[^/]+/v(?:/.*)?$', dest: '/__fallback', has: unfurl },
      { src: '^/a/[^/]+/v(?:/.*)?$', dest: '/_spa.html' },
    ])
    expect(routes[6]).toEqual(isrRoute)
  })

  it('sends link preview bots to the server renderer and everyone else to the shell', () => {
    addSpaShellRoutes(dir, '/_spa.html', ['/code/**'])

    const { routes } = readConfig() as {
      routes: Array<{ dest?: string; has?: Array<{ value: string }> }>
    }
    const select = (userAgent: string) =>
      routes
        .slice(2, 4)
        .find(
          route => !route.has || route.has.every(c => new RegExp(`^${c.value}$`).test(userAgent)),
        )?.dest

    const unfurlers = [
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)',
      'Twitterbot/1.0',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)',
      'TelegramBot (like TwitterBot)',
      'WhatsApp/2.23.20.0 A',
      'http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)',
      'Mozilla/5.0 (compatible; Bluesky Cardyb/1.1; +mailto:support@bsky.app)',
      'Mozilla/5.0 (compatible; redditbot/1.0; +http://www.reddit.com/feedback)',
      'Mozilla/5.0 (Windows NT 6.1; WOW64) SkypeUriPreview Preview/0.5 skype-url-preview@microsoft.com',
      'Iframely/1.3.1 (+https://iframely.com/docs/about)',
      'Mozilla/5.0 (compatible; Embedly/0.2; +http://support.embed.ly/)',
    ]
    const others = [
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    ]
    const destinations = (userAgents: string[]) =>
      Object.fromEntries(userAgents.map(userAgent => [userAgent, select(userAgent)]))

    expect(destinations(unfurlers)).toEqual(
      Object.fromEntries(unfurlers.map(userAgent => [userAgent, '/__fallback'])),
    )
    expect(destinations(others)).toEqual(
      Object.fromEntries(others.map(userAgent => [userAgent, '/_spa.html'])),
    )
  })

  it('throws when the shell was server-rendered', () => {
    writeFileSync(resolve(dir, 'static/_spa.html'), '<script data-ssr="true"></script>')
    expect(() => addSpaShellRoutes(dir, '/_spa.html', ['/code/**'])).toThrow(
      /not a client-only shell/,
    )
  })

  it('throws when the server renderer route is missing', () => {
    writeFileSync(
      resolve(dir, 'config.json'),
      JSON.stringify({ routes: [{ handle: 'filesystem' }] }),
    )
    expect(() => addSpaShellRoutes(dir, '/_spa.html', ['/code/**'])).toThrow(
      /could not find the route to \/__fallback/,
    )
  })
})
