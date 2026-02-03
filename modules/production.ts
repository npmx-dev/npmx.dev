import { defineNuxtModule, useNuxt } from 'nuxt/kit'
import { defu } from 'defu'
import { isCI, provider } from 'std-env'

export default defineNuxtModule({
  meta: {
    name: 'prod-env',
  },
  setup() {
    const nuxt = useNuxt()

    if (isCI && provider !== 'github_actions') {
      nuxt.options.debug = defu(nuxt.options.debug, { hydration: true })
      nuxt.options.sourcemap = {
        server: true,
        client: true,
      }
    }
  },
})
