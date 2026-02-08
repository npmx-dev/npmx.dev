import type { BuildInfo } from '../shared/types'
import { createResolver, defineNuxtModule } from 'nuxt/kit'
import { isCI } from 'std-env'
import { getEnv, getFileLastUpdated, version } from '../config/env'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtModule({
  meta: {
    name: 'npmx:build-env',
  },
  async setup(_options, nuxt) {
    const [{ env, commit, shortCommit, branch }, privacyPolicyDate] = await Promise.all([
      getEnv(nuxt.options.dev),
      getFileLastUpdated('app/pages/privacy.vue'),
    ])

    nuxt.options.appConfig = nuxt.options.appConfig || {}
    nuxt.options.appConfig.env = env
    nuxt.options.appConfig.buildInfo = {
      version,
      time: +Date.now(),
      commit,
      shortCommit,
      branch,
      env,
      privacyPolicyDate,
    } satisfies BuildInfo

    nuxt.options.nitro.publicAssets = nuxt.options.nitro.publicAssets || []
    if (env === 'dev') nuxt.options.nitro.publicAssets.unshift({ dir: resolve('../public-dev') })
    else if (env === 'canary' || env === 'preview' || !isCI)
      nuxt.options.nitro.publicAssets.unshift({ dir: resolve('../public-staging') })
  },
})

declare module '@nuxt/schema' {
  interface AppConfig {
    env: BuildInfo['env']
    buildInfo: BuildInfo
  }
}
