import { addServerPlugin, createResolver, defineNuxtModule, useNuxt } from 'nuxt/kit'

export default defineNuxtModule({
  meta: {
    name: 'fixtures',
  },
  setup() {
    const nuxt = useNuxt()
    const resolver = createResolver(import.meta.url)

    if (nuxt.options.test) {
      addServerPlugin(resolver.resolve('./runtime/server/cache.ts'))

      nuxt.hook('nitro:config', nitroConfig => {
        nitroConfig.storage ||= {}
        nitroConfig.storage['fixtures'] = {
          driver: 'fsLite',
          base: resolver.resolve('../test/fixtures'),
        }
      })
    }
  },
})
