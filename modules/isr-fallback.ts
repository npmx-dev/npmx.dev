import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

const PACKAGE_FUNCTION = 'package/[...]-isr'
const CRAWLER_FUNCTION = 'package/[...]-isr-crawler'
const CRAWLER_USER_AGENT =
  '.*(?:[Bb]ot|[Cc]rawl|[Ss]pider|Slurp|facebookexternalhit|Mediapartners|ia_archiver|embedly).*'

interface VercelRoute {
  src?: string
  dest?: string
  has?: Array<{ type: string; key: string; value?: string }>
}

export default defineNuxtModule({
  meta: {
    name: 'isr-fallback',
  },
  setup(_, nuxt) {
    if (provider !== 'vercel') {
      return
    }

    nuxt.hook('nitro:init', nitro => {
      const htmlFallback = 'spa.prerender-fallback.html'
      const jsonFallback = 'payload-fallback.json'
      nitro.hooks.hook('compiled', () => {
        const spaTemplate = readFileSync(nitro.options.output.publicDir + '/200.html', 'utf-8')
        for (const path of [
          'package',
          'package/[name]',
          'package/[name]/v',
          'package/[name]/v/[version]',
          'package/[org]',
          'package/[org]/[name]',
          'package/[org]/[name]/v',
          'package/[org]/[name]/v/[version]',
          '',
        ]) {
          const outputPath = resolve(nitro.options.output.serverDir, '..', path, htmlFallback)
          mkdirSync(resolve(nitro.options.output.serverDir, '..', path), { recursive: true })
          writeFileSync(outputPath, spaTemplate)
          writeFileSync(outputPath.replace(htmlFallback, jsonFallback), '[{}]')
        }
        addCrawlerFunction(resolve(nitro.options.output.dir))
      })
    })
  },
})

export function addCrawlerFunction(outputDir: string) {
  const functionsDir = resolve(outputDir, 'functions')
  const { fallback: _, ...prerenderConfig } = JSON.parse(
    readFileSync(resolve(functionsDir, `${PACKAGE_FUNCTION}.prerender-config.json`), 'utf-8'),
  )
  writeFileSync(
    resolve(functionsDir, `${CRAWLER_FUNCTION}.prerender-config.json`),
    JSON.stringify(prerenderConfig, null, 2),
  )
  symlinkSync('./../__fallback.func', resolve(functionsDir, `${CRAWLER_FUNCTION}.func`))

  const configPath = resolve(outputDir, 'config.json')
  const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { routes: VercelRoute[] }
  const index = config.routes.findIndex(route => route.dest?.startsWith(`/${PACKAGE_FUNCTION}?`))
  const route = config.routes[index]
  if (!route?.dest) {
    throw new Error(`[isr-fallback] could not find the route to /${PACKAGE_FUNCTION}`)
  }
  config.routes.splice(index, 0, {
    ...route,
    dest: route.dest.replace(`/${PACKAGE_FUNCTION}?`, `/${CRAWLER_FUNCTION}?`),
    has: [{ type: 'header', key: 'user-agent', value: CRAWLER_USER_AGENT }],
  })
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}
