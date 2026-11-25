import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createResolver, defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'
import { OG_INVALID_CACHE_CONTROL } from './runtime/server/og-image-error-handler'

interface VercelRoute {
  handle?: string
  src?: string
  dest?: string
  status?: number
  headers?: Record<string, string>
  continue?: boolean
}

export const MISSING_STATIC_OG_CACHE_CONTROL = OG_INVALID_CACHE_CONTROL
export const RESOLVER_OG_CACHE_CONTROL = OG_INVALID_CACHE_CONTROL
export const LEGACY_OG_CACHE_CONTROL = 'public, max-age=86400, s-maxage=86400'

const DISABLED_OG_RESOLVER_ROUTES = new Set(['/_og/r', '/_og/r/**', '/_og/r.png'])

export default defineNuxtModule({
  meta: {
    name: 'og-image-cache',
  },
  setup(_, nuxt) {
    const resolver = createResolver(import.meta.url)
    const disableResolver = !nuxt.options.dev

    nuxt.hook('modules:done', () => {
      if (disableResolver && nuxt.options.routeRules) {
        for (const route of DISABLED_OG_RESOLVER_ROUTES) {
          delete nuxt.options.routeRules[route]
        }
      }
    })

    nuxt.hook('nitro:config', nitroConfig => {
      const existing = nitroConfig.errorHandler
        ? Array.isArray(nitroConfig.errorHandler)
          ? nitroConfig.errorHandler
          : [nitroConfig.errorHandler]
        : []
      nitroConfig.errorHandler = [
        resolver.resolve('./runtime/server/og-image-error-handler'),
        ...existing,
      ]

      // Remove the unused /_og/r resolver handlers so they cannot be used as an
      // unsigned same-origin SSR proxy.
      if (disableResolver && nitroConfig.handlers) {
        nitroConfig.handlers = nitroConfig.handlers.filter(
          h => !h?.route || !DISABLED_OG_RESOLVER_ROUTES.has(h.route),
        )
      }

      // Drop the blanket 24h Cache-Control route header on /_og/d/** so Vercel does not
      // overwrite per-status Cache-Control headers emitted by the handler and error handler.
      const ogDynamicRule = nitroConfig.routeRules?.['/_og/d/**']
      if (ogDynamicRule?.headers && 'cache-control' in ogDynamicRule.headers) {
        delete ogDynamicRule.headers['cache-control']
        if (Object.keys(ogDynamicRule.headers).length === 0) {
          delete ogDynamicRule.headers
        }
      }
    })

    if (provider !== 'vercel') {
      return
    }

    nuxt.hook('nitro:init', nitro => {
      nitro.hooks.hook('compiled', () => {
        addOgImageEdgeRules(resolve(nitro.options.output.dir))
      })
    })
  },
})

export function addOgImageEdgeRules(outputDir: string) {
  const configPath = resolve(outputDir, 'config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { routes: VercelRoute[] }
  const filesystemIndex = config.routes.findIndex(route => route.handle === 'filesystem')
  if (filesystemIndex === -1) {
    throw new Error('[og-image-cache] could not find the filesystem handle route')
  }

  config.routes.splice(
    filesystemIndex + 1,
    0,
    {
      src: '^/_og/s(?:/.*)?$',
      status: 404,
      headers: {
        'cache-control': MISSING_STATIC_OG_CACHE_CONTROL,
      },
      continue: false,
    },
    {
      src: '^/_og/r(?:/.*|\\.png/?)?$',
      status: 404,
      headers: {
        'cache-control': RESOLVER_OG_CACHE_CONTROL,
      },
      continue: false,
    },
    {
      src: '^/__og-image__(?:/.*)?$',
      status: 410,
      headers: {
        'cache-control': LEGACY_OG_CACHE_CONTROL,
      },
      continue: false,
    },
  )

  writeFileSync(configPath, JSON.stringify(config, null, 2))
}
