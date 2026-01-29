import { defineNuxtModule, useNuxt } from 'nuxt/kit'
import { execSync } from 'node:child_process'
import { join } from 'node:path'

export default defineNuxtModule({
  meta: {
    name: 'lunaria',
  },
  setup() {
    const nuxt = useNuxt()

    nuxt.options.nitro.publicAssets ||= []
    nuxt.options.nitro.publicAssets.push({
      dir: join(nuxt.options.rootDir, 'dist/lunaria/'),
      baseURL: '/lunaria/',
      maxAge: 60 * 60 * 24, // 1 day
    })

    if (nuxt.options.dev || nuxt.options._prepare || nuxt.options.test) {
      return
    }

    nuxt.hook('nitro:build:before', async () => {
      execSync('node --experimental-transform-types ./lunaria/lunaria.ts', {
        cwd: nuxt.options.rootDir,
      })
    })
  },
})
