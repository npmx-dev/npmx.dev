import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { defu } from 'defu'
import { provider } from 'std-env'

/** Prerendered client-only shell, served on Vercel for every client-only route. */
export const SPA_SHELL = '/_spa.html'

/** Route rule patterns rendered client-side only. */
export const CLIENT_ONLY_ROUTES = [
  '/package-code/**',
  '/package/code/:name/v/**',
  '/package/code/:org/:name/v/**',
  '/package-docs/**',
  '/docs/:path/**',
  '/package/docs/:name/v/**',
  '/package/docs/:org/:name/v/**',
]

interface VercelRoute {
  src?: string
  dest?: string
  handle?: string
}

export default defineNuxtModule({
  meta: {
    name: 'spa-shells',
  },
  setup(_, nuxt) {
    const routeRules = (nuxt.options.routeRules ??= {})
    const clientOnly = { ssr: false, headers: { 'X-Robots-Tag': 'noindex' } }
    routeRules[SPA_SHELL] = defu(routeRules[SPA_SHELL], { ...clientOnly, prerender: true })
    for (const route of CLIENT_ONLY_ROUTES) {
      routeRules[route] = defu(routeRules[route], clientOnly)
    }

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
  config.routes.splice(
    index + 1,
    0,
    ...routes.map(route => ({ src: routeToVercelSrc(route), dest: shell })),
  )
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}
