import { defineNuxtModule, useNuxt } from 'nuxt/kit'
import { execSync } from 'node:child_process'
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'
import { isCI, isTest } from 'std-env'
import { getEnv } from '../config/env.ts'

export default defineNuxtModule({
  meta: {
    name: 'lunaria',
  },
  setup() {
    const nuxt = useNuxt()

    const lunariaDistPath = join(nuxt.options.rootDir, 'dist/lunaria/')

    nuxt.options.nitro.publicAssets ||= []
    nuxt.options.nitro.publicAssets.push({
      dir: lunariaDistPath,
      baseURL: '/lunaria/',
      maxAge: 60 * 60 * 24, // 1 day
    })

    if (nuxt.options.dev || nuxt.options._prepare || nuxt.options.test || isTest) {
      return
    }

    if (!isCI || !existsSync(lunariaDistPath)) {
      mkdirSync(lunariaDistPath, { recursive: true })
      nuxt.hook('nitro:build:before', async () => {
        try {
          execSync('node --experimental-transform-types ./lunaria/lunaria.ts', {
            cwd: nuxt.options.rootDir,
          })
        } catch (e) {
          // Always throw in local dev.
          // In CI, only throw if building for production.
          const { env } = await getEnv(!isCI)
          if (env === 'dev' || env === 'release') {
            throw e
          }
        }
      })
    }
  },
})
