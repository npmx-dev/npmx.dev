import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { all } from 'module-replacements'
import { addTemplate, defineNuxtModule } from 'nuxt/kit'
import { getModuleReplacement } from '#shared/utils/module-replacements'

export const REPLACEMENTS_BASE_URL = '/_replacements'

interface VercelRoute {
  src?: string
  handle?: string
  status?: number
  headers?: Record<string, string>
}

/**
 * Exposes the names of packages that have a module replacement, and the base URL of their
 * build-time JSON files, as `#module-replacements`.
 */
export default defineNuxtModule({
  meta: {
    name: 'module-replacements',
  },
  setup(_, nuxt) {
    const names = Object.keys(all.mappings)
    const hash = createHash('sha256').update(JSON.stringify(all)).digest('hex').slice(0, 12)
    const baseURL = `${REPLACEMENTS_BASE_URL}/${hash}`

    addTemplate({
      filename: 'module-replacements.ts',
      write: true,
      getContents: () =>
        [
          `export const replacementNames: ReadonlySet<string> = new Set(${JSON.stringify(names)})`,
          `export const replacementsBaseURL = ${JSON.stringify(baseURL)}`,
        ].join('\n'),
    })
    nuxt.options.alias['#module-replacements'] = join(nuxt.options.buildDir, 'module-replacements')

    // oxlint-disable-next-line eslint/no-underscore-dangle
    if (nuxt.options._prepare) {
      return
    }

    const publicDir = resolve(nuxt.options.rootDir, 'node_modules/.cache/module-replacements')
    rmSync(publicDir, { recursive: true, force: true })
    for (const name of names) {
      const file = join(publicDir, hash, `${name}.json`)
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, JSON.stringify(getModuleReplacement(name)))
    }

    nuxt.hook('nitro:config', nitroConfig => {
      nitroConfig.publicAssets ||= []
      nitroConfig.publicAssets.push({
        dir: publicDir,
        baseURL: REPLACEMENTS_BASE_URL,
        fallthrough: false,
        maxAge: 60 * 60 * 24 * 365,
      })
    })

    nuxt.hook('nitro:init', nitro => {
      if (!nitro.options.preset.startsWith('vercel')) {
        return
      }
      nitro.hooks.hook('compiled', () => {
        addNotFoundRoute(resolve(nitro.options.output.dir, 'config.json'))
      })
    })
  },
})

/** Responds to misses under the replacements base with a 404 from the CDN. */
export function addNotFoundRoute(configPath: string) {
  const config = JSON.parse(readFileSync(configPath, 'utf-8')) as { routes: VercelRoute[] }
  const index = config.routes.findIndex(route => route.handle === 'filesystem')
  if (index === -1) {
    throw new Error('[module-replacements] could not find the filesystem route')
  }
  config.routes.splice(index + 1, 0, {
    src: `^${REPLACEMENTS_BASE_URL}/.*$`,
    status: 404,
    headers: { 'cache-control': 'no-store' },
  })
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}
