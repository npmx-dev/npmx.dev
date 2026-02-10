import type { BuildInfo, EnvType } from '../shared/types'
import { createResolver, defineNuxtModule } from 'nuxt/kit'
import { isCI } from 'std-env'
import { getEnv, getFileLastUpdated, version } from '../config/env'

const { resolve } = createResolver(import.meta.url)

export default defineNuxtModule({
  meta: {
    name: 'npmx:build-env',
  },
  async setup(_options, nuxt) {
    let env: EnvType = 'dev'
    nuxt.options.appConfig = nuxt.options.appConfig || {}
    nuxt.options.appConfig.env = env
    if (process.env.TEST) {
      const time = new Date()
      nuxt.options.appConfig.buildInfo = {
        env,
        version: '0.0.0',
        commit: '704987bba88909f3782d792c224bde989569acb9',
        shortCommit: '704987b',
        branch: 'xxx',
        time: time.getTime(),
        privacyPolicyDate: time.toISOString(),
      } satisfies BuildInfo
    } else {
      const [{ env: useEnv, commit, shortCommit, branch }, privacyPolicyDate] = await Promise.all([
        getEnv(nuxt.options.dev),
        getFileLastUpdated('app/pages/privacy.vue'),
      ])
      env = useEnv
      nuxt.options.appConfig.env = useEnv
      nuxt.options.appConfig.buildInfo = {
        version,
        time: +Date.now(),
        commit,
        shortCommit,
        branch,
        env,
        privacyPolicyDate,
      } satisfies BuildInfo
    }

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
