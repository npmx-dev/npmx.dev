import { readFileSync, writeFileSync } from 'node:fs'
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
      nitro.hooks.hook('compiled', () => {
        const spaTemplate = readFileSync(nitro.options.output.publicDir + '/200.html', 'utf-8')
        for (const path of ['package', '']) {
          const outputPath = resolve(
            nitro.options.output.serverDir,
            '..',
            path,
            'spa.prerender-fallback.html',
          )
          writeFileSync(outputPath, spaTemplate)
        }
      })
    })
  },
})
