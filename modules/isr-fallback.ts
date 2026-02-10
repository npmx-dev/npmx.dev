import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { provider } from 'std-env'

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
          writeFileSync(outputPath.replace(htmlFallback, jsonFallback), '{}')
        }
      })
    })
  },
})
