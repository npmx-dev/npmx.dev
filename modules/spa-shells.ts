import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { defu } from 'defu'
import { provider } from 'std-env'
import { UNFURL_USER_AGENT_PATTERN } from '#shared/utils/unfurl'

/** Prerendered client-only shell, served on Vercel for every client-only route. */
export const SPA_SHELL = '/_spa.html'

/** Route rule patterns rendered client-side only, except for link preview bots. */
export const CLIENT_ONLY_ROUTES = [
  '/package-code/**',
  '/package/code/:name/v/**',
  '/package/code/:org/:name/v/**',
  '/package-docs/**',
  '/docs/:path/**',
  '/package/docs/:name/v/**',
  '/package/docs/:org/:name/v/**',
  '/package-changelog/**',
  '/changelog/:name/**',
]

const SSR_FUNCTION = '/__fallback'

interface VercelRoute {
  src?: string
  dest?: string
  handle?: string
  has?: Array<{ type: string; key: string; value?: string }>
}

export default defineNuxtModule({
  meta: {
    name: 'spa-shells',
  },
  setup(_, nuxt) {
    const routeRules = (nuxt.options.routeRules ??= {})
    const noindex = { headers: { 'X-Robots-Tag': 'noindex' } }
    routeRules[SPA_SHELL] = defu(routeRules[SPA_SHELL], { ...noindex, ssr: false, prerender: true })
    for (const route of CLIENT_ONLY_ROUTES) {
      routeRules[route] = defu(routeRules[route], noindex)
    }

    // Apply `ssr: false` after `routes.mjs` is generated so Nuxt keeps these pages
    // in the server bundle for runtime unfurl SSR (`server/middleware/unfurl-ssr.ts`).
    nuxt.hook('nitro:build:before', nitro => {
      for (const route of CLIENT_ONLY_ROUTES) {
        nitro.options.routeRules[route] = defu(nitro.options.routeRules[route], { ssr: false })
      }
    })

    if (provider !== 'vercel') {
      return
    }

    nuxt.hook('nitro:init', nitro => {
      nitro.hooks.hook('compiled', () => {
        addSpaShellRoutes(resolve(nitro.options.output.dir), SPA_SHELL, CLIENT_ONLY_ROUTES)
      })
    })
  },
})

export function routeToVercelSrc(route: string) {
  const src = route
    .split('/')
    .filter(Boolean)
    .map(segment => {
      if (segment === '**') return '(?:/.*)?'
      if (segment.startsWith(':')) return '/[^/]+'
      return '/' + segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return `^${src}$`
}

export function addSpaShellRoutes(outputDir: string, shell: string, routes: string[]) {
  const html = readFileSync(join(outputDir, 'static', shell), 'utf-8')
  if (!html.includes('data-ssr="false"')) {
    throw new Error(`[spa-shells] ${shell} is not a client-only shell`)
  }

  const configPath = resolve(outputDir, 'config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { routes: VercelRoute[] }
  const index = config.routes.findIndex(route => route.handle === 'filesystem')
  if (index === -1) {
    throw new Error('[spa-shells] could not find the filesystem handler')
  }
  if (!config.routes.some(route => route.dest === SSR_FUNCTION)) {
    throw new Error(`[spa-shells] could not find the route to ${SSR_FUNCTION}`)
  }
  config.routes.splice(
    index + 1,
    0,
    ...routes.flatMap(route => [
      {
        src: routeToVercelSrc(route),
        dest: SSR_FUNCTION,
        has: [{ type: 'header', key: 'user-agent', value: UNFURL_USER_AGENT_PATTERN }],
      },
      { src: routeToVercelSrc(route), dest: shell },
    ]),
  )
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}
